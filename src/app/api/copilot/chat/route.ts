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
      // Demo previews may use the synthetic chunk set. A live workspace must
      // never receive demo material it did not upload; empty retrieval means
      // the Copilot must abstain.
      if (auth.isDemo) {
        candidateChunks = DEMO_CHUNKS;
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
