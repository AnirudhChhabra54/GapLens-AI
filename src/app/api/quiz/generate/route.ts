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
import {
  generateDiagnosticQuestions,
  toSafeQuizQuestion,
  type GeneratedQuestionResult,
} from "@/lib/algorithms/question-generator";
import type { SafeQuizQuestion } from "@/types/assessment";
import { DEMO_TOPICS, DEMO_CHUNKS, DEMO_QUIZ_QUESTIONS } from "@/lib/demo/os-cs301-fixture";

const GenerateQuizRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  topicIds: z.array(z.string()).optional(),
  targetCount: z.number().int().min(1).max(20).default(6),
  difficulty: z.number().int().min(1).max(3).default(2),
  quizMode: z.enum(["diagnostic", "drill", "retest"]).default("diagnostic"),
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

    const { workspaceId, topicIds, targetCount, difficulty, quizMode } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let chunks: any[] = [];

    if (isLiveDb) {
      let topicQuery = admin.from("topics").select("*").eq("workspace_id", workspaceId);
      if (topicIds && topicIds.length > 0) {
        topicQuery = topicQuery.in("id", topicIds);
      }
      const { data: topicData } = await topicQuery;

      const { data: chunkData } = await admin
        .from("document_chunks")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (topicData && topicData.length > 0) topics = topicData;
      if (chunkData && chunkData.length > 0) chunks = chunkData;
    }

    if (topics.length === 0) {
      topics = topicIds && topicIds.length > 0
        ? DEMO_TOPICS.filter((t) => topicIds.includes(t.id))
        : DEMO_TOPICS;
    }
    if (chunks.length === 0) chunks = DEMO_CHUNKS;

    const quizId = `quiz-${Date.now()}`;
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

    // Persist quiz and questions if live DB
    if (isLiveDb) {
      await admin.from("quizzes").insert({
        id: quizId,
        workspace_id: workspaceId,
        user_id: auth.userId,
        title: `${quizMode.toUpperCase()} Assessment — ${new Date().toLocaleDateString()}`,
        quiz_mode: quizMode,
        target_topic_ids: topics.map((t) => t.id),
        is_completed: false,
        started_at: new Date().toISOString(),
      });

      for (let i = 0; i < generated.length; i++) {
        const q = generated[i];
        const qId = `qq-${quizId}-${i + 1}`;
        q.id = qId;

        await admin.from("quiz_questions").insert({
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
      }
    } else {
      // Assign IDs in mock mode
      generated.forEach((q, i) => {
        q.id = q.id || `qq-${quizId}-${i + 1}`;
      });
    }

    // Strip answer keys and rubrics for client runner
    const topicMap = new Map(topics.map((t) => [t.id, t.title]));
    const safeQuestions: SafeQuizQuestion[] = generated.map((q) =>
      toSafeQuizQuestion(q, topicMap.get(q.topicId))
    );

    return NextResponse.json({
      success: true,
      quizId,
      workspaceId,
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
