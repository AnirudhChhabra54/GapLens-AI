// ==============================================================================
// GapLens AI — Past-Paper Question Mapping API Route
// POST /api/papers/map
// Maps past-paper questions to syllabus topics with confidence scoring,
// flags low confidence mappings (<0.60) as needs_review, and updates topic exam weights.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import {
  mapPastPaperQuestions,
  computeTopicExamWeights,
  type PaperQuestionInput,
} from "@/lib/algorithms/topic-mapper";
import { DEMO_TOPICS, DEMO_CHUNKS, DEMO_DOCUMENTS } from "@/lib/demo/os-cs301-fixture";

const PaperQuestionSchema = z.object({
  paperYear: z.number().nullable().optional(),
  paperName: z.string().nullable().optional(),
  questionNumber: z.string(),
  questionText: z.string().min(5),
  marks: z.number().min(1),
  documentId: z.string().uuid().optional(),
});

const MapPapersRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  documentId: z.string().uuid().optional(),
  questions: z.array(PaperQuestionSchema).min(1),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MapPapersRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, documentId, questions } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let chunks: any[] = [];

    if (isLiveDb) {
      const { data: topicData } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);

      const { data: chunkData } = await admin
        .from("document_chunks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (topicData && topicData.length > 0) topics = topicData;
      if (chunkData && chunkData.length > 0) chunks = chunkData;
    }

    if (topics.length === 0) topics = DEMO_TOPICS;
    if (chunks.length === 0) chunks = DEMO_CHUNKS;

    const paperInputs: PaperQuestionInput[] = questions.map((q) => ({
      paperYear: q.paperYear ?? null,
      paperName: q.paperName ?? null,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      marks: q.marks,
      documentId: q.documentId || documentId || DEMO_DOCUMENTS[0].id,
      workspaceId,
    }));

    const mapped = mapPastPaperQuestions({
      questions: paperInputs,
      topics,
      chunks,
    });

    // Compute updated topic exam weights
    const simulatedPaperRows = mapped.map((m, idx) => ({
      id: `mapped-pq-${idx + 1}`,
      workspace_id: workspaceId,
      document_id: m.documentId,
      paper_year: m.paperYear,
      paper_name: m.paperName,
      question_number: m.questionNumber,
      question_text: m.questionText,
      marks: m.marks,
      mapped_topic_id: m.mappedTopicId,
      mapping_confidence: m.mappingConfidence,
      needs_review: m.needsReview,
      supporting_chunk_id: m.supportingChunkId,
      mapping_rationale: m.mappingRationale,
      created_at: new Date().toISOString(),
    }));

    const examWeightsMap = computeTopicExamWeights(topics, simulatedPaperRows);

    if (isLiveDb) {
      // Insert paper_questions rows
      for (const row of simulatedPaperRows) {
        await admin.from("paper_questions").insert(row);
      }

      // Update topic exam weights
      for (const [topicId, weightUpdate] of examWeightsMap.entries()) {
        await admin
          .from("topics")
          .update({
            exam_frequency: weightUpdate.examFrequency,
            exam_total_marks: weightUpdate.examTotalMarks,
            exam_weight: weightUpdate.examWeight,
            updated_at: new Date().toISOString(),
          })
          .eq("id", topicId);
      }
    }

    return NextResponse.json({
      success: true,
      workspaceId,
      mappedCount: mapped.length,
      needsReviewCount: mapped.filter((m) => m.needsReview).length,
      mappedQuestions: mapped,
      examWeights: Array.from(examWeightsMap.values()),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to map past-paper questions", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
