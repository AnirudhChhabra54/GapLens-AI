// ==============================================================================
// GapLens AI — Feynman Teach-Back Evidence-Diff Audit API Route
// POST /api/feynman/evaluate
// Evaluates a student's free-form explanation strictly against retrieved chunks.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { hybridSearch } from "@/lib/rag/hybrid-retrieval";
import { embedText } from "@/lib/ai/provider";
import { evaluateFeynmanTeachBack } from "@/lib/algorithms/feynman";
import { DEMO_CHUNKS } from "@/lib/demo/os-cs301-fixture";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

const FeynmanRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  topicTitle: z.string().min(1, "Topic title is required"),
  explanation: z.string().min(15, "Please write at least 15 characters explaining the concept."),
  topics: z.array(z.any()).optional(),
  documents: z.array(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = FeynmanRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, topicTitle, explanation, topics: suppliedTopics, documents: suppliedDocs } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rl = checkRateLimit(`feynman:${auth.userId}`, 25, 60_000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    let candidateChunks: any[] = [];

    if (auth.isDemo) {
      const emb = await embedText(topicTitle, "retrieval.query");
      const searchRes = await hybridSearch(
        {
          queryText: topicTitle,
          queryEmbedding: emb.embedding,
          workspaceId,
          matchCount: 4,
        },
        { candidateChunks: DEMO_CHUNKS }
      );
      candidateChunks = searchRes.results.length > 0 ? searchRes.results : DEMO_CHUNKS.slice(0, 3);
    } else {
      if (isSupabaseAdminConfigured()) {
        const { data: dbChunks, error } = await getSupabaseAdmin()
          .from("document_chunks")
          .select("*")
          .eq("workspace_id", workspaceId)
          .limit(20);

        if (!error && dbChunks && dbChunks.length > 0) {
          const emb = await embedText(topicTitle, "retrieval.query");
          const searchRes = await hybridSearch(
            {
              queryText: topicTitle,
              queryEmbedding: emb.embedding,
              workspaceId,
              matchCount: 4,
            },
            { candidateChunks: dbChunks }
          );
          candidateChunks = searchRes.results.length > 0 ? searchRes.results : dbChunks.slice(0, 3);
        } else if (error && !isMissingSchemaError(error)) {
          return NextResponse.json(
            { error: "Failed to query course evidence", details: error.message },
            { status: 500 }
          );
        }
      }

      if (candidateChunks.length === 0) {
        for (const doc of suppliedDocs || []) {
          const text = doc.extracted_text || doc.extractedText;
          if (text && typeof text === "string" && text.trim().length > 0) {
            candidateChunks.push({
              id: doc.id || crypto.randomUUID(),
              document_id: doc.id || "",
              document_name: doc.filename || "Uploaded Course Material",
              page_start: 1,
              page_end: 1,
              section_heading: topicTitle,
              content: text.slice(0, 1500),
            });
          }
        }
      }

      if (candidateChunks.length === 0) {
        const matchedTopic = (suppliedTopics || []).find(
          (t: any) => (t.title || "").toLowerCase() === topicTitle.toLowerCase()
        );
        const objectives = Array.isArray(matchedTopic?.learning_objectives)
          ? matchedTopic.learning_objectives.join(". ")
          : `Core principles, mechanisms, and applications of ${topicTitle}.`;
        candidateChunks.push({
          id: "syllabus-fallback",
          document_id: "syllabus",
          document_name: "Course Syllabus",
          page_start: 1,
          page_end: 1,
          section_heading: matchedTopic?.unit_module || topicTitle,
          content: `Topic: ${topicTitle}\nCurriculum Scope: ${objectives}`,
        });
      }
    }

    const audit = await evaluateFeynmanTeachBack({
      topicTitle,
      studentExplanation: explanation,
      chunks: candidateChunks,
    });

    return NextResponse.json({
      success: true,
      ...audit,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to run Feynman Teach-Back audit", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
