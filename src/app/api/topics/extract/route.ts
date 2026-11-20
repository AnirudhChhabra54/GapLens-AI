// ==============================================================================
// GapLens AI — Syllabus Topic Extraction API Route
// POST /api/topics/extract
// Extracts units, topics, subtopics, and prerequisites from syllabus document chunks.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { extractTopicHierarchy } from "@/lib/algorithms/topic-mapper";
import { DEMO_CHUNKS } from "@/lib/demo/os-cs301-fixture";
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
      if (error) {
        return NextResponse.json(
          { error: "Failed to load syllabus chunks", details: error.message },
          { status: 500 }
        );
      }

      chunks = data || [];
      if (!textToParse) {
        textToParse = chunks.map((c) => c.content).join("\n\n");
      }

      if (!textToParse.trim()) {
        return NextResponse.json(
          { error: "No processed syllabus text is available for this workspace." },
          { status: 422 }
        );
      }
    } else if (auth.isDemo) {
      chunks = DEMO_CHUNKS;
      textToParse = textToParse || DEMO_CHUNKS.map((c) => c.content).join("\n\n");
    } else {
      if (!textToParse.trim()) {
        return NextResponse.json(
          { error: "No processed syllabus text is available for this workspace. Upload your course syllabus first." },
          { status: 422 }
        );
      }
    }

    const extraction = await extractTopicHierarchy({
      syllabusText: textToParse,
      chunks,
    });

    if (extraction.topics.length === 0) {
      return NextResponse.json(
        { error: "No topics could be extracted from the provided syllabus text." },
        { status: 422 }
      );
    }

    const insertedTopics: any[] = [];
    const insertedPrerequisites: any[] = [];
    const titleToId = new Map<string, string>();
    const topicKey = (title: string, unitModule: string | null) =>
      `${(unitModule || "").trim().toLowerCase()}::${title.trim().toLowerCase()}`;

    if (isLiveDb) {
      const { data: existingTopics, error: existingTopicsError } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (existingTopicsError) {
        return NextResponse.json(
          { error: "Failed to load existing topics", details: existingTopicsError.message },
          { status: 500 }
        );
      }

      for (const existing of existingTopics || []) {
        titleToId.set(topicKey(existing.title, existing.unit_module), existing.id);
        insertedTopics.push(existing);
      }

      for (const t of extraction.topics) {
        const key = topicKey(t.title, t.unitModule);
        if (titleToId.has(key)) continue;

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

        if (insertErr || !topicRow) {
          return NextResponse.json(
            {
              error: "Failed to save extracted topic",
              details: insertErr?.message || "Topic insert returned no row",
            },
            { status: 500 }
          );
        }

        insertedTopics.push(topicRow);
        titleToId.set(key, topicRow.id);
        titleToId.set(topicKey(topicRow.title, topicRow.unit_module), topicRow.id);
      }

      for (const prereq of extraction.prerequisites) {
        const topicId = titleToId.get(topicKey(prereq.topicTitle, null)) ||
          Array.from(titleToId.entries()).find(([key]) => key.endsWith(`::${prereq.topicTitle.trim().toLowerCase()}`))?.[1];
        const prerequisiteTopicId = titleToId.get(topicKey(prereq.prereqTitle, null)) ||
          Array.from(titleToId.entries()).find(([key]) => key.endsWith(`::${prereq.prereqTitle.trim().toLowerCase()}`))?.[1];

        if (!topicId || !prerequisiteTopicId || topicId === prerequisiteTopicId) continue;

        const { data: prereqRow, error: prereqError } = await admin
          .from("topic_prerequisites")
          .upsert(
            {
              workspace_id: workspaceId,
              topic_id: topicId,
              prerequisite_topic_id: prerequisiteTopicId,
              is_inferred: prereq.isInferred,
              confidence: prereq.confidence,
              source_rationale: prereq.rationale,
            },
            { onConflict: "topic_id,prerequisite_topic_id", ignoreDuplicates: true }
          )
          .select()
          .maybeSingle();

        if (prereqError) {
          return NextResponse.json(
            { error: "Failed to save topic prerequisite", details: prereqError.message },
            { status: 500 }
          );
        }

        if (prereqRow) insertedPrerequisites.push(prereqRow);
      }
    } else {
      const demoIdByKey = new Map<string, string>();

      extraction.topics.forEach((t) => {
        const id = crypto.randomUUID();
        demoIdByKey.set(topicKey(t.title, t.unitModule), id);
        demoIdByKey.set(topicKey(t.title, null), id);
        insertedTopics.push({
          id,
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
        });
      });

      for (const prereq of extraction.prerequisites) {
        const topicId = demoIdByKey.get(topicKey(prereq.topicTitle, null));
        const prerequisiteTopicId = demoIdByKey.get(topicKey(prereq.prereqTitle, null));
        if (!topicId || !prerequisiteTopicId) continue;

        insertedPrerequisites.push({
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          topic_id: topicId,
          prerequisite_topic_id: prerequisiteTopicId,
          is_inferred: prereq.isInferred,
          confidence: prereq.confidence,
          source_rationale: prereq.rationale,
        });
      }
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      topicsCount: insertedTopics.length,
      topics: insertedTopics,
      prerequisites: insertedPrerequisites,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to extract topics", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
