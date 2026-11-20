// ==============================================================================
// GapLens AI — Syllabus Topic Extraction API Route
// POST /api/topics/extract
// Extracts units, topics, subtopics, and prerequisites from syllabus document chunks.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { extractTopicHierarchy } from "@/lib/algorithms/topic-mapper";
import { DEMO_CHUNKS, DEMO_TOPICS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";
import { authorizeWorkspace } from "@/lib/supabase/auth";

const ExtractTopicsRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  documentId: z.string().uuid().optional(),
  syllabusText: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = ExtractTopicsRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, documentId, syllabusText } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let chunks: any[] = [];
    let textToParse = syllabusText || "";

    if (isLiveDb) {
      let query = admin
        .from("document_chunks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (documentId) {
        query = query.eq("document_id", documentId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        chunks = data;
        if (!textToParse) {
          textToParse = data.map((c) => c.content).join("\n\n");
        }
      }
    }

    // Fallback to demo fixture if offline or no chunks found
    if (!textToParse || chunks.length === 0) {
      chunks = DEMO_CHUNKS;
      textToParse = textToParse || DEMO_CHUNKS.map((c) => c.content).join("\n\n");
    }

    const extraction = await extractTopicHierarchy({
      syllabusText: textToParse,
      chunks,
    });

    const insertedTopics: any[] = [];

    if (isLiveDb) {
      for (const t of extraction.topics) {
        const { data: topicRow, error: insertErr } = await admin
          .from("topics")
          .insert({
            workspace_id: workspaceId,
            user_id: auth.userId,
            title: t.title,
            unit_module: t.unitModule,
            order_index: t.orderIndex,
            learning_objectives: t.learningObjectives,
            source_chunk_id: t.sourceChunkId,
            extraction_confidence: t.extractionConfidence,
            exam_frequency: 0,
            exam_total_marks: 0,
            exam_weight: 0,
            current_mastery: 45.0,
            classification: "unassessed",
            evidence_level: "early_signal",
            total_attempts: 0,
            correct_attempts: 0,
            blind_spot_count: 0,
          })
          .select()
          .single();

        if (!insertErr && topicRow) {
          insertedTopics.push(topicRow);
        }
      }
    } else {
      // Offline mock representation
      insertedTopics.push(
        ...extraction.topics.map((t, i) => ({
          id: `topic-extracted-${i + 1}`,
          workspace_id: workspaceId,
          title: t.title,
          unit_module: t.unitModule,
          order_index: t.orderIndex,
          learning_objectives: t.learningObjectives,
          extraction_confidence: t.extractionConfidence,
          current_mastery: 45.0,
          classification: "unassessed",
          evidence_level: "early_signal",
          exam_weight: 0,
        }))
      );
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      topicsCount: insertedTopics.length,
      topics: insertedTopics.length > 0 ? insertedTopics : DEMO_TOPICS,
      prerequisites: extraction.prerequisites.length > 0 ? extraction.prerequisites : DEMO_PREREQUISITES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to extract topics", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
