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
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import {
  mapPastPaperQuestions,
  computeTopicExamWeights,
  extractPastPaperQuestionsFromText,
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
  questions: z.array(PaperQuestionSchema).optional(),
  topics: z.array(z.any()).optional(),
  paperText: z.string().optional(),
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

    const { workspaceId, documentId, questions, topics: suppliedTopics, paperText: suppliedPaperText } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rl = checkRateLimit(`papers-map:${auth.userId}`, 20, 60_000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    let isSchemaMissing = false;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let chunks: any[] = [];

    if (isLiveDb) {
      const { data: topicData, error: topicError } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (topicError) {
        if (isMissingSchemaError(topicError)) {
          isSchemaMissing = true;
        } else {
          return NextResponse.json(
            { error: "Failed to load workspace topics", details: topicError.message },
            { status: 500 }
          );
        }
      }

      if (!isSchemaMissing) {
        const { data: chunkData, error: chunkError } = await admin
          .from("document_chunks")
          .select("*")
          .eq("workspace_id", workspaceId);
        if (chunkError) {
          if (isMissingSchemaError(chunkError)) {
            isSchemaMissing = true;
          } else {
            return NextResponse.json(
              { error: "Failed to load indexed course chunks", details: chunkError.message },
              { status: 500 }
            );
          }
        }

        topics = topicData || [];
        chunks = chunkData || [];

        const suppliedQuestions = questions || [];
        const requestedDocumentIds = Array.from(
          new Set([
            ...(documentId ? [documentId] : []),
            ...suppliedQuestions.map((q) => q.documentId).filter((id): id is string => Boolean(id)),
          ])
        );

        if (!isSchemaMissing && requestedDocumentIds.length > 0 && chunks.length > 0) {
          const { data: ownedDocuments, error: documentError } = await admin
            .from("documents")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("user_id", auth.userId)
            .in("id", requestedDocumentIds);
          if (documentError && !isMissingSchemaError(documentError)) {
            return NextResponse.json(
              { error: "Failed to verify past-paper document ownership", details: documentError.message },
              { status: 500 }
            );
          }

          if (!documentError) {
            const ownedDocumentIds = new Set((ownedDocuments || []).map((doc) => doc.id));
            const missingDocumentIds = requestedDocumentIds.filter((id) => !ownedDocumentIds.has(id));
            if (missingDocumentIds.length > 0) {
              return NextResponse.json(
                { error: `Past-paper document not found in this workspace: ${missingDocumentIds.join(", ")}` },
                { status: 404 }
              );
            }
          }
        }
      }

      if (topics.length === 0 && suppliedTopics && suppliedTopics.length > 0) {
        topics = suppliedTopics;
      }
      if (chunks.length === 0 && suppliedPaperText && suppliedPaperText.trim().length > 0) {
        chunks = [
          {
            id: crypto.randomUUID(),
            document_id: documentId || crypto.randomUUID(),
            workspace_id: workspaceId,
            content: suppliedPaperText.trim(),
            section_heading: "Past Exam Paper",
            page_start: 1,
            page_end: 1,
          },
        ];
      }

      if (topics.length === 0) {
        return NextResponse.json(
          { error: "No indexed topics are available for this workspace. Extract the syllabus first." },
          { status: 422 }
        );
      }
      if (chunks.length === 0 && (!questions || questions.length === 0)) {
        return NextResponse.json(
          { error: "No indexed course material is available. Upload and process the past paper first." },
          { status: 422 }
        );
      }
    } else if (auth.isDemo) {
      topics = DEMO_TOPICS;
      chunks = DEMO_CHUNKS;
    } else {
      return NextResponse.json(
        { error: "No indexed topics or course material found for this workspace. Extract the syllabus first." },
        { status: 422 }
      );
    }

    const targetDocId = documentId || (questions?.[0]?.documentId ?? (chunks[0]?.document_id ?? (auth.isDemo ? DEMO_DOCUMENTS[0].id : crypto.randomUUID())));
    let paperInputs: PaperQuestionInput[] = [];

    if (questions && questions.length > 0) {
      paperInputs = questions.map((q) => ({
        paperYear: q.paperYear ?? null,
        paperName: q.paperName ?? null,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        marks: q.marks,
        documentId: q.documentId || targetDocId,
        workspaceId,
      }));
    } else {
      // Automatically extract questions from relevant document chunks
      const relevantChunks = documentId
        ? chunks.filter((c) => c.document_id === documentId)
        : chunks;
      const paperText = relevantChunks.map((c) => c.content).join("\n\n");

      paperInputs = extractPastPaperQuestionsFromText(paperText, targetDocId, workspaceId);

      if (paperInputs.length === 0) {
        return NextResponse.json(
          { error: "No questions could be extracted from this past-paper document." },
          { status: 422 }
        );
      }
    }

    const mapped = mapPastPaperQuestions({
      questions: paperInputs,
      topics,
      chunks,
    });

    // Compute updated topic exam weights
    const simulatedPaperRows = mapped.map((m) => ({
      id: crypto.randomUUID(),
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

    let examWeightsMap = computeTopicExamWeights(topics, simulatedPaperRows);

    if (isLiveDb && !isSchemaMissing) {
      // Deduplicate: remove any earlier mapped questions for this past paper document
      await admin
        .from("paper_questions")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("document_id", targetDocId);

      // Insert fresh paper_questions rows
      const { error: paperInsertError } = await admin
        .from("paper_questions")
        .insert(simulatedPaperRows);
      if (paperInsertError) {
        return NextResponse.json(
          { error: "Failed to save mapped past-paper questions", details: paperInsertError.message },
          { status: 500 }
        );
      }

      // Query ALL historical paper questions across all uploaded past papers in this workspace
      const { data: allPaperRows } = await admin
        .from("paper_questions")
        .select("*")
        .eq("workspace_id", workspaceId);

      // Recompute normalized weights across all past papers
      examWeightsMap = computeTopicExamWeights(topics, (allPaperRows as any[]) || simulatedPaperRows);

      // Update topic exam weights
      for (const [topicId, weightUpdate] of examWeightsMap.entries()) {
        const { error: weightUpdateError } = await admin
          .from("topics")
          .update({
            exam_frequency: weightUpdate.examFrequency,
            exam_total_marks: weightUpdate.examTotalMarks,
            exam_weight: weightUpdate.examWeight,
            updated_at: new Date().toISOString(),
          })
          .eq("id", topicId)
          .eq("workspace_id", workspaceId);
        if (weightUpdateError) {
          return NextResponse.json(
            { error: "Failed to update topic exam weights", details: weightUpdateError.message },
            { status: 500 }
          );
        }
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
