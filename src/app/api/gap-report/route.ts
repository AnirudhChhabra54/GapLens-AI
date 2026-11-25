// ==============================================================================
// GapLens AI — Topic Gap Report & Readiness API Route
// GET /api/gap-report?workspaceId=...
// Calculates a transparent Preparation Coverage Indicator, assessed syllabus
// coverage, evidence-aware mastery reconstructed from raw answers, confidence
// calibration metrics, blind spots, and urgent remedy actions.
// ==============================================================================

import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { aggregateBlindSpots, type EvaluatedAnswerInput } from "@/lib/algorithms/blind-spots";
import { reconstructMasteryFromAttempts } from "@/lib/algorithms/mastery";
import type { TopicMastery, GapReportData, ReadinessMetrics } from "@/types/assessment";
import type { PinnedCitation } from "@/types/rag";
import {
  DEMO_WORKSPACE,
  DEMO_TOPICS,
  DEMO_ANSWERS,
  DEMO_QUIZ_QUESTIONS,
  DEMO_DOCUMENTS,
} from "@/lib/demo/os-cs301-fixture";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Query parameter 'workspaceId' is required" },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let workspace: any = auth.isDemo
      ? DEMO_WORKSPACE
      : { id: workspaceId, title: "My Course Workspace", exam_date: null };
    let topics: any[] = auth.isDemo ? DEMO_TOPICS : [];
    let answers: any[] = auth.isDemo ? DEMO_ANSWERS : [];
    let questions: any[] = auth.isDemo ? DEMO_QUIZ_QUESTIONS : [];

    if (isLiveDb) {
      const { data: wsData, error: wsErr } = await admin
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .eq("user_id", auth.userId)
        .maybeSingle();

      if (wsErr && isMissingSchemaError(wsErr)) {
        // Schema not yet initialized; continue with offline/empty workspace state
      } else if (!wsData) {
        return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
      } else {
        workspace = wsData;

        const { data: tData } = await admin
          .from("topics")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("order_index", { ascending: true });

        topics = tData || [];

        const topicIds = topics.map((t) => t.id);
        if (topicIds.length > 0) {
          const { data: aData } = await admin
            .from("answers")
            .select("*")
            .eq("user_id", auth.userId)
            .in("topic_id", topicIds)
            .order("answered_at", { ascending: true });
          answers = aData || [];
        } else {
          answers = [];
        }

        const questionIds = answers.map((a) => a.quiz_question_id).filter(Boolean);
        if (questionIds.length > 0) {
          const { data: qData } = await admin
            .from("quiz_questions")
            .select("*")
            .in("id", questionIds);
          questions = qData || [];
        } else {
          questions = [];
        }
      }
    }

    // Build question lookup map for citation info
    const questionMap = new Map<string, any>();
    for (const q of questions) {
      questionMap.set(q.id, q);
    }

    // Build topic lookup map
    const topicMap = new Map<string, any>();
    for (const t of topics) {
      topicMap.set(t.id, t);
    }

    // Fetch chunk metadata to populate true documentId and docType in citations
    const chunkIds = Array.from(
      new Set(
        Array.from(questionMap.values())
          .map((q) => q.source_chunk_id)
          .filter(Boolean)
      )
    );
    const chunkMetaMap = new Map<string, { documentId: string; docType: DocumentType }>();
    if (isLiveDb && chunkIds.length > 0) {
      const { data: chunksData } = await admin
        .from("document_chunks")
        .select("id, document_id, documents(id, doc_type)")
        .in("id", chunkIds);
      if (chunksData) {
        for (const c of chunksData) {
          const doc = (c as any).documents;
          chunkMetaMap.set(c.id, {
            documentId: c.document_id || doc?.id || "",
            docType: (doc?.doc_type as DocumentType) || "material",
          });
        }
      }
    }

    // Convert answers to EvaluatedAnswerInput for blind-spot aggregation
    const evaluatedAnswerInputs: EvaluatedAnswerInput[] = answers.map((a) => {
      const q = questionMap.get(a.quiz_question_id || a.question_id);
      const t = topicMap.get(a.topic_id);
      const chunkMeta = q?.source_chunk_id ? chunkMetaMap.get(q.source_chunk_id) : undefined;

      const citation: PinnedCitation = {
        chunkId: q?.source_chunk_id || "unavailable",
        documentId: chunkMeta?.documentId || (q as any)?.document_id || (auth.isDemo ? DEMO_DOCUMENTS[0]?.id : ""),
        documentName: q?.citation_document_name || (auth.isDemo ? DEMO_DOCUMENTS[0]?.filename : "Uploaded course material"),
        docType: chunkMeta?.docType || (q as any)?.doc_type || "material",
        pageStart: q?.citation_page_start || 1,
        pageEnd: q?.citation_page_end || 1,
        sectionHeading: q?.citation_section || t?.title || null,
        quote: q?.citation_quote || null,
        isQuoteVerified: q?.is_quote_verified ?? false,
      };

      return {
        topicId: a.topic_id,
        topicTitle: t?.title || "Topic",
        questionId: a.quiz_question_id || a.question_id || "q-id",
        questionText: q?.question_text || "Diagnostic Question",
        studentResponse: a.student_response || "",
        correctAnswer: q?.answer_key || "Model Answer",
        confidence: a.confidence || "medium",
        score: a.score ?? 0,
        citation,
        explanation: q?.explanation,
      };
    });

    const blindSpots = aggregateBlindSpots(evaluatedAnswerInputs);

    // Reconstruct mastery from answer records rather than trusting only the
    // cached denormalized topic score.
    const now = new Date();
    const topicMasteries: TopicMastery[] = topics.map((t) => {
      const tAnswers = answers.filter((a) => a.topic_id === t.id);
      const reconstructed = reconstructMasteryFromAttempts(
        tAnswers.map((a) => ({
          score: a.score ?? 0,
          difficulty: questionMap.get(a.quiz_question_id)?.difficulty ?? 2,
          answeredAt: a.answered_at ?? null,
        })),
        now
      );

      const hasAttempts = tAnswers.length > 0;
      const tBlindSpots = blindSpots.items.filter((b) => b.topicId === t.id).length;

      return {
        topicId: t.id,
        topicTitle: t.title,
        unitModule: t.unit_module || null,
        masteryScore: hasAttempts ? reconstructed.masteryScore : t.current_mastery ?? 45.0,
        classification: hasAttempts ? reconstructed.classification : t.classification || "unassessed",
        evidenceLevel: hasAttempts ? reconstructed.evidenceLevel : t.evidence_level || "early_signal",
        totalAttempts: hasAttempts ? tAnswers.length : t.total_attempts ?? 0,
        correctAttempts: hasAttempts
          ? tAnswers.filter((a) => a.is_correct || a.score >= 0.7).length
          : t.correct_attempts ?? 0,
        blindSpotCount: tBlindSpots,
        examWeight: t.exam_weight ?? 0.0,
        examFrequency: t.exam_frequency ?? 0,
        lastAttemptAt: tAnswers[tAnswers.length - 1]?.answered_at || null,
      };
    });

    // Compute Preparation Coverage Indicator (Readiness)
    const assessedTopics = topicMasteries.filter((t) => t.totalAttempts > 0);
    const totalTopicsCount = topicMasteries.length;
    const assessedTopicsCount = assessedTopics.length;
    const coveragePercentage = totalTopicsCount > 0
      ? Number(((assessedTopicsCount / totalTopicsCount) * 100).toFixed(1))
      : 0;

    let weightedMasterySum = 0;
    let totalAssessedWeight = 0;

    for (const at of assessedTopics) {
      const w = at.examWeight > 0 ? at.examWeight : 1.0 / assessedTopicsCount;
      weightedMasterySum += at.masteryScore * w;
      totalAssessedWeight += w;
    }

    const averageMastery = totalAssessedWeight > 0
      ? Number((weightedMasterySum / totalAssessedWeight).toFixed(1))
      : 0;

    // Readiness score: combination of coverage and average mastery on assessed topics
    const readinessScore = Number(((coveragePercentage / 100) * averageMastery).toFixed(1));
    const isDataSufficient = assessedTopicsCount >= 2;

    const readiness: ReadinessMetrics = {
      readinessScore,
      assessedTopicsCount,
      totalTopicsCount,
      coveragePercentage,
      averageMastery,
      isDataSufficient,
      insufficiencyReason: isDataSufficient
        ? undefined
        : "Not enough assessment data. Complete diagnostic assessments on at least 2 topics to calibrate readiness.",
    };

    // Calculate days remaining to exam
    let daysRemaining: number | null = null;
    if (workspace.exam_date) {
      const examTime = new Date(workspace.exam_date).getTime();
      const nowTime = new Date().getTime();
      daysRemaining = Math.max(0, Math.ceil((examTime - nowTime) / (1000 * 60 * 60 * 24)));
    }

    // Urgent remedy actions
    const urgentActions = blindSpots.items.slice(0, 5).map((bs) => ({
      topicId: bs.topicId,
      topicTitle: bs.topicTitle,
      remedyAction: bs.remedyAction,
      citation: bs.citation,
    }));

    const gapReport: GapReportData = {
      workspaceId,
      workspaceTitle: workspace.title || "Operating Systems (CS-301)",
      examDate: workspace.exam_date || null,
      daysRemaining,
      readiness,
      blindSpots,
      topics: topicMasteries,
      urgentActions,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ...gapReport, isDemo: auth.isDemo });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate gap report", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
