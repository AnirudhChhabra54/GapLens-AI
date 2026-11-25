// ==============================================================================
// GapLens AI — Grounded Quiz Generation API Route
// POST /api/quiz/generate
// Generates grounded MCQs and rubric-based short answers with verified chunk citations.
// Strips answer keys and rubrics, returning SafeQuizQuestion records to client runners.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import {
  generateDiagnosticQuestions,
  toSafeQuizQuestion,
  type GeneratedQuestionResult,
} from "@/lib/algorithms/question-generator";
import type { SafeQuizQuestion } from "@/types/assessment";
import { DEMO_TOPICS, DEMO_CHUNKS, DEMO_QUIZ_QUESTIONS } from "@/lib/demo/os-cs301-fixture";
import { storeDemoQuiz, sealQuizSession } from "@/lib/demo/demo-quiz-cache";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

const GenerateQuizRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  topicIds: z.array(z.string()).optional(),
  targetCount: z.number().int().min(1).max(20).default(6),
  difficulty: z.number().int().min(1).max(3).default(2),
  quizMode: z.enum(["diagnostic", "drill", "retest", "exam"]).default("diagnostic"),
  topics: z.array(z.any()).optional(),
  documents: z.array(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = GenerateQuizRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, topicIds, targetCount, difficulty, quizMode, topics: suppliedTopics, documents: suppliedDocuments } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rl = checkRateLimit(`quiz-gen:${auth.userId}`, 25, 60_000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    let isSchemaMissing = false;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let chunks: any[] = [];

    if (isLiveDb) {
      let topicQuery = admin.from("topics").select("*").eq("workspace_id", workspaceId);
      if (topicIds && topicIds.length > 0) {
        topicQuery = topicQuery.in("id", topicIds);
      }
      const { data: topicData, error: topicError } = await topicQuery;
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
      }

      if (topics.length === 0 && suppliedTopics && suppliedTopics.length > 0) {
        topics = topicIds && topicIds.length > 0
          ? suppliedTopics.filter((t: any) => topicIds.includes(t.id))
          : suppliedTopics;
      }

      if (chunks.length === 0) {
        const fallbackChunks: any[] = [];
        for (const doc of suppliedDocuments || []) {
          const text = doc.extracted_text || doc.extractedText;
          if (text && typeof text === "string" && text.trim().length > 0) {
            const paragraphs = text.split(/\n\n+/).filter((p: string) => p.trim().length > 30);
            paragraphs.slice(0, 15).forEach((p: string, idx: number) => {
              fallbackChunks.push({
                id: `${doc.id || "doc"}-${idx}`,
                document_id: doc.id || "doc",
                workspace_id: workspaceId,
                document_name: doc.filename || "Uploaded Course Material",
                page_start: 1,
                page_end: 1,
                section_heading: doc.filename || "Course Notes",
                content: p.trim(),
              });
            });
          }
        }
        if (fallbackChunks.length === 0 && topics.length > 0) {
          for (const t of topics) {
            const objectives = Array.isArray(t.learning_objectives) && t.learning_objectives.length > 0
              ? t.learning_objectives.join(". ")
              : `Core principles, definitions, and applications of ${t.title}.`;
            fallbackChunks.push({
              id: `syllabus-${t.id}`,
              document_id: "syllabus",
              workspace_id: workspaceId,
              document_name: "Course Syllabus",
              page_start: 1,
              page_end: 1,
              section_heading: t.unit_module ? `${t.unit_module} — ${t.title}` : t.title,
              content: `Unit: ${t.unit_module || "Curriculum"}\nTopic: ${t.title}\nScope & Learning Objectives: ${objectives}`,
            });
          }
        }
        chunks = fallbackChunks;
      }

      if (topics.length === 0) {
        return NextResponse.json(
          { error: "No indexed topics are available for this workspace. Extract the syllabus first." },
          { status: 422 }
        );
      }
      if (chunks.length === 0) {
        return NextResponse.json(
          { error: "No indexed course material is available. Upload and process a syllabus or notes first." },
          { status: 422 }
        );
      }
    } else if (auth.isDemo) {
      if (topics.length === 0) {
        topics = topicIds && topicIds.length > 0
          ? DEMO_TOPICS.filter((t) => topicIds.includes(t.id))
          : DEMO_TOPICS;
      }
      if (chunks.length === 0) chunks = DEMO_CHUNKS;
    } else {
      return NextResponse.json(
        { error: "No indexed topics or course material available. Extract syllabus and upload material first." },
        { status: 422 }
      );
    }

    const quizId = crypto.randomUUID();
    const generated: GeneratedQuestionResult[] = [];
    const questionsPerTopic = Math.max(1, Math.ceil(targetCount / topics.length));

    for (const topic of topics) {
      if (generated.length >= targetCount) break;

      // Filter chunks relevant to this topic
      const topicChunks = chunks.filter((c) =>
        c.content.toLowerCase().includes(topic.title.toLowerCase())
      );
      const candidates = topicChunks.length > 0 ? topicChunks : chunks;

      // Mix MCQs and Short Answers: alternate or generate MCQ primarily
      const qType = generated.length % 2 === 0 ? "mcq" : "short_answer";

      const topicQuestions = await generateDiagnosticQuestions({
        topicId: topic.id,
        topicTitle: topic.title,
        chunks: candidates,
        questionType: qType,
        difficulty,
        existingQuestions: generated,
        targetCount: questionsPerTopic,
      });

      for (const q of topicQuestions) {
        if (generated.length < targetCount) {
          generated.push(q);
        }
      }
    }

    // Fallback if no questions could be generated
    if (generated.length === 0) {
      if (!auth.isDemo) {
        return NextResponse.json(
          { error: "Unable to generate grounded questions from the indexed course material." },
          { status: 422 }
        );
      }

      for (const demoQ of DEMO_QUIZ_QUESTIONS.slice(0, targetCount)) {
        generated.push({
          id: demoQ.id,
          topicId: demoQ.topic_id,
          questionType: demoQ.question_type,
          difficulty: demoQ.difficulty,
          questionText: demoQ.question_text,
          options: demoQ.options,
          answerKey: demoQ.answer_key,
          explanation: demoQ.explanation,
          rubric: demoQ.rubric,
          sourceChunkId: demoQ.source_chunk_id,
          citationDocumentName: demoQ.citation_document_name,
          citationPageStart: demoQ.citation_page_start,
          citationPageEnd: demoQ.citation_page_end,
          citationSection: demoQ.citation_section,
          citationQuote: demoQ.citation_quote,
          isQuoteVerified: demoQ.is_quote_verified,
        });
      }
    }

    // Persist quiz and questions if live DB and schema initialized
    if (isLiveDb && !isSchemaMissing) {
      const { error: quizInsertError } = await admin.from("quizzes").insert({
        id: quizId,
        workspace_id: workspaceId,
        user_id: auth.userId,
        title: `${quizMode.toUpperCase()} Assessment — ${new Date().toLocaleDateString()}`,
        quiz_mode: quizMode,
        target_topic_ids: topics.map((t) => t.id),
        is_completed: false,
        started_at: new Date().toISOString(),
      });

      if (quizInsertError) {
        if (isMissingSchemaError(quizInsertError)) {
          isSchemaMissing = true;
        } else {
          return NextResponse.json(
            { error: "Failed to save generated quiz", details: quizInsertError.message },
            { status: 500 }
          );
        }
      }

      if (!isSchemaMissing) {
        for (const q of generated) {
          const qId = crypto.randomUUID();
          q.id = qId;

          const { error: questionInsertError } = await admin.from("quiz_questions").insert({
            id: qId,
            quiz_id: quizId,
            topic_id: q.topicId,
            question_type: q.questionType,
            difficulty: q.difficulty,
            question_text: q.questionText,
            options: q.options,
            answer_key: q.answerKey,
            explanation: q.explanation,
            rubric: q.rubric,
            source_chunk_id: q.sourceChunkId,
            citation_document_name: q.citationDocumentName,
            citation_page_start: q.citationPageStart,
            citation_page_end: q.citationPageEnd,
            citation_section: q.citationSection,
            citation_quote: q.citationQuote,
            is_quote_verified: q.isQuoteVerified,
          });

          if (questionInsertError) {
            await admin.from("quizzes").delete().eq("id", quizId);
            return NextResponse.json(
              { error: "Failed to save generated questions", details: questionInsertError.message },
              { status: 500 }
            );
          }
        }
      }
    }

    let quizSessionToken: string | null = null;
    if (!isLiveDb || isSchemaMissing) {
      // Assign valid UUIDs in mock mode and cache questions server-side
      generated.forEach((q) => {
        q.id = q.id || crypto.randomUUID();
      });
      const cachedQuestions = generated.map((q) => ({
        id: q.id,
        quiz_id: quizId,
        topic_id: q.topicId,
        question_type: q.questionType,
        difficulty: q.difficulty,
        question_text: q.questionText,
        options: q.options || null,
        answer_key: q.answerKey,
        explanation: q.explanation || "Evaluated according to course syllabus rubric.",
        rubric: q.rubric || null,
        source_chunk_id: q.sourceChunkId || null,
        citation_document_name: q.citationDocumentName || null,
        citation_page_start: q.citationPageStart || null,
        citation_page_end: q.citationPageEnd || null,
        citation_section: q.citationSection || null,
        citation_quote: q.citationQuote || null,
        is_quote_verified: q.isQuoteVerified || false,
        created_at: new Date().toISOString(),
      }));
      storeDemoQuiz(quizId, cachedQuestions as any);
      quizSessionToken = sealQuizSession(quizId, cachedQuestions as any);
    }

    // Strip answer keys and rubrics for client runner
    const topicMap = new Map(topics.map((t) => [t.id, t.title]));
    const safeQuestions: SafeQuizQuestion[] = generated.map((q) =>
      toSafeQuizQuestion(q, topicMap.get(q.topicId))
    );

    return NextResponse.json({
      success: true,
      quizId,
      quizSessionToken,
      workspaceId,
      quizMode,
      totalQuestions: safeQuestions.length,
      questions: safeQuestions,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate diagnostic quiz", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
