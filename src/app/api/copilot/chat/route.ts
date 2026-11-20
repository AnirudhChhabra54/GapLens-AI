// ==============================================================================
// GapLens AI — Grounded Study Copilot API Route
// POST /api/copilot/chat
// Source-locked conversational assistant. Answers strictly from retrieved course chunks.
// Detects prompt injection and explicitly abstains when course material lacks evidence.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { processCopilotChat } from "@/lib/algorithms/copilot";
import { hybridSearch } from "@/lib/rag/hybrid-retrieval";
import { embedText } from "@/lib/ai/gemini";
import { DEMO_CHUNKS, DEMO_TOPICS } from "@/lib/demo/os-cs301-fixture";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import type { CopilotChatResponse } from "@/types/planner";

const CopilotChatRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  message: z.string().min(1, "Message cannot be empty"),
  topicId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      })
    )
    .optional(),
  topics: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        unitModule: z.string().nullable().optional(),
        learningObjectives: z.array(z.string()).optional(),
      })
    )
    .optional(),
  documents: z
    .array(
      z.object({
        id: z.string().optional(),
        filename: z.string(),
        storagePath: z.string().nullable().optional(),
        extractedText: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = CopilotChatRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, message, topicId, history } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let candidateChunks: any[] = [];
    let topicTitle: string | undefined;

    if (topicId) {
      if (auth.isDemo) {
        const foundTopic = DEMO_TOPICS.find((t) => t.id === topicId);
        if (foundTopic) topicTitle = foundTopic.title;
      } else if (isSupabaseAdminConfigured()) {
        const { data: topicData, error: topicError } = await getSupabaseAdmin()
          .from("topics")
          .select("title")
          .eq("id", topicId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (topicError) {
          return NextResponse.json(
            { error: "Failed to load the selected topic", details: topicError.message },
            { status: 500 }
          );
        }

        if (topicData) topicTitle = topicData.title;
      }
    }

    try {
      const { embedding } = await embedText(message, "retrieval.query");
      const retrieval = await hybridSearch({
        workspaceId,
        queryText: message,
        queryEmbedding: embedding,
        matchCount: 6,
      });

      if (retrieval.results && retrieval.results.length > 0) {
        candidateChunks = retrieval.results;
      }
    } catch {
      // Offline fallback
    }

    if (candidateChunks.length === 0) {
      if (auth.isDemo) {
        candidateChunks = DEMO_CHUNKS;
      } else {
        const admin = getSupabaseAdmin();
        let availableTopics = parsed.data.topics || [];

        if (availableTopics.length === 0 && isSupabaseAdminConfigured()) {
          const { data: dbTopics } = await admin
            .from("topics")
            .select("id, title, unit_module, learning_objectives")
            .eq("workspace_id", workspaceId);
          if (dbTopics && dbTopics.length > 0) {
            availableTopics = dbTopics.map((t) => ({
              id: t.id,
              title: t.title,
              unitModule: t.unit_module,
              learningObjectives: t.learning_objectives || [],
            }));
          }
        }

        const generatedChunks: any[] = [];

        for (const t of availableTopics) {
          generatedChunks.push({
            id: t.id || crypto.randomUUID(),
            document_id: "syllabus-document",
            workspace_id: workspaceId,
            document_name: "Curriculum Syllabus",
            page_start: 1,
            page_end: 1,
            section_heading: `${t.unitModule ? `${t.unitModule} > ` : ""}${t.title}`,
            content: `Course Curriculum Unit: ${t.unitModule || "Core Syllabus"}\nTopic: ${t.title}\nCurriculum Scope & Learning Objectives:\n${(t.learningObjectives && t.learningObjectives.length > 0 ? t.learningObjectives : [`Core theoretical principles and applications of ${t.title}`]).join("\n")}`,
            similarity: 0.85,
            rrf_score: 0.05,
          });
        }

        for (const doc of parsed.data.documents || []) {
          if (doc.extractedText && doc.extractedText.trim().length > 0) {
            const paragraphs = doc.extractedText.split(/\n\n+/).filter((p) => p.trim().length > 30);
            paragraphs.slice(0, 15).forEach((p, pIdx) => {
              generatedChunks.push({
                id: `${doc.id || "doc"}-${pIdx}`,
                document_id: doc.id || "doc",
                workspace_id: workspaceId,
                document_name: doc.filename,
                page_start: 1,
                page_end: 1,
                section_heading: doc.filename,
                content: p.trim(),
                similarity: 0.8,
                rrf_score: 0.04,
              });
            });
          }
        }

        if (generatedChunks.length > 0) {
          const queryLower = message.toLowerCase();
          const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 3);
          const matchingChunks = generatedChunks.filter((c) => {
            const contentLower = c.content.toLowerCase();
            return queryTokens.some((t) => contentLower.includes(t));
          });

          candidateChunks = matchingChunks.length > 0 ? matchingChunks.slice(0, 6) : generatedChunks.slice(0, 4);
        }
      }
    }

    const response: CopilotChatResponse = await processCopilotChat({
      message,
      chunks: candidateChunks,
      topicTitle,
      history,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to process Copilot query", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
