// ==============================================================================
// GapLens AI — Quiz Answer Evaluation API Route
// POST /api/quiz/evaluate
// Evaluates MCQ & rubric short-answers, captures decoupled confidence,
// reconstructs evidence-aware mastery per topic, records blind spots, writes
// mastery snapshots, and re-plans pending revision work after a retest.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace, verifyQuizQuestionOwnership } from "@/lib/supabase/auth";
import { evaluateSubmission } from "@/lib/algorithms/evaluator";
import { rankTopicsByPriority, type RawTopicFactorsInput } from "@/lib/algorithms/priority";
import { updatePlanAfterRetest } from "@/lib/algorithms/scheduler";
import type { QuizQuestionRow, TopicRow, TopicPrerequisiteRow } from "@/types/database";
import type { StudentAnswerSubmission, QuizEvaluationResponse } from "@/types/assessment";
import type { ScheduledTask } from "@/types/planner";
import {
  DEMO_QUIZ_QUESTIONS,
  DEMO_TOPICS,
  DEMO_ANSWERS,
} from "@/lib/demo/os-cs301-fixture";

const AnswerSubmissionSchema = z.object({
  questionId: z.string(),
  response: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
});

const EvaluateQuizRequestSchema = z.object({
  quizId: z.string(),
  workspaceId: z.string().uuid("Invalid workspace ID"),
  answers: z.array(AnswerSubmissionSchema).min(1, "At least one answer must be submitted"),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = EvaluateQuizRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { quizId, workspaceId, answers } = parsed.data;
    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();
    const userId = auth.userId;
    const submittedIds = answers.map((a) => a.questionId);

    let questions: QuizQuestionRow[] = [];
    let topics: TopicRow[] = [];
    let prerequisites: TopicPrerequisiteRow[] = [];
    const currentMasteryMap = new Map<string, number>();
    const historicalAttemptsMap = new Map<string, Array<{ score: number; difficulty: number }>>();

    if (isLiveDb) {
      const owned = await verifyQuizQuestionOwnership({ quizId, workspaceId, questionIds: submittedIds });
      if (!owned.ok) {
        return NextResponse.json({ error: owned.error }, { status: owned.status });
      }

      const { data: existingQuiz } = await admin
        .from("quizzes")
        .select("id, is_completed")
        .eq("id", quizId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (existingQuiz?.is_completed) {
        return NextResponse.json(
          { error: "This quiz has already been submitted.", alreadySubmitted: true },
          { status: 409 }
        );
      }

      const { data: qData, error: qError } = await admin
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .in("id", submittedIds);

      if (qError) {
        return NextResponse.json({ error: "Failed to load quiz questions." }, { status: 500 });
      }
      questions = (qData || []) as QuizQuestionRow[];

      if (questions.length !== submittedIds.length) {
        return NextResponse.json(
          { error: "One or more submitted questions could not be verified for this quiz." },
          { status: 400 }
        );
      }

      const { data: topicData } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);

      topics = (topicData || []) as TopicRow[];
      for (const t of topics) {
        currentMasteryMap.set(t.id, t.current_mastery ?? 45.0);
      }

      const { data: prereqData } = await admin
        .from("topic_prerequisites")
        .select("*")
        .eq("workspace_id", workspaceId);
      prerequisites = (prereqData || []) as TopicPrerequisiteRow[];

      const topicIds = topics.map((t) => t.id);
      if (topicIds.length > 0) {
        const { data: prevAnswers } = await admin
          .from("answers")
          .select("quiz_id, topic_id, score, answered_at")
          .eq("user_id", userId)
          .in("topic_id", topicIds)
          .order("answered_at", { ascending: true });

        if (prevAnswers) {
          for (const pa of prevAnswers) {
            // Exclude this quiz's own saved rows. A retry after a partial write
            // must rebuild from prior history, not double-count the retry.
            if (pa.quiz_id === quizId) continue;
            const list = historicalAttemptsMap.get(pa.topic_id) || [];
            list.push({ score: pa.score ?? 0, difficulty: 2 });
            historicalAttemptsMap.set(pa.topic_id, list);
          }
        }
      }
    } else {
      // Offline demo preview: only synthetic fixture records are used.
      questions = DEMO_QUIZ_QUESTIONS.filter((q) => submittedIds.includes(q.id));
      if (questions.length !== submittedIds.length) {
        return NextResponse.json(
          {
            error:
              "Offline demo mode only accepts questions from the synthetic demo quiz. Configure Supabase to grade real quizzes.",
            isDemo: true,
          },
          { status: 400 }
        );
      }
      for (const t of DEMO_TOPICS) {
        currentMasteryMap.set(t.id, t.current_mastery);
      }
      for (const a of DEMO_ANSWERS) {
        const list = historicalAttemptsMap.get(a.topic_id) || [];
        list.push({ score: a.score, difficulty: 2 });
        historicalAttemptsMap.set(a.topic_id, list);
      }
    }

    const submissions: StudentAnswerSubmission[] = answers.map((a) => ({
      questionId: a.questionId,
      response: a.response,
      confidence: a.confidence,
    }));

    const evalResult: QuizEvaluationResponse = await evaluateSubmission({
      quizId,
      workspaceId,
      submissions,
      questions,
      currentMasteryMap,
      historicalAttemptsMap,
    });

    let planUpdated = false;
    let planWarning: string | null = null;

    if (isLiveDb) {
      // Persist each answer with the student's real response. The unique
      // (quiz_id, quiz_question_id) constraint makes a retry idempotent.
      const responseByQuestion = new Map(answers.map((a) => [a.questionId, a.response]));
      const storedQuestionIds = new Set(questions.map((q) => q.id));

      for (const ans of evalResult.answers) {
        if (!storedQuestionIds.has(ans.questionId)) continue;
        const { error: answerError } = await admin.from("answers").upsert(
          {
            quiz_id: quizId,
            quiz_question_id: ans.questionId,
            topic_id: ans.topicId,
            user_id: userId,
            student_response: responseByQuestion.get(ans.questionId) || "",
            confidence: ans.confidence,
            is_correct: ans.isCorrect,
            score: ans.score,
            rubric_evaluation: ans.rubricEvaluation || null,
            feedback: ans.feedback,
            is_blind_spot: ans.isBlindSpot,
            answered_at: new Date().toISOString(),
          },
          { onConflict: "quiz_id,quiz_question_id" }
        );

        if (answerError) {
          return NextResponse.json(
            { error: "Failed to persist answer records.", details: answerError.message },
            { status: 500 }
          );
        }
      }

      const blindSpotsThisAttempt = new Map<string, number>();
      for (const ans of evalResult.answers) {
        if (ans.isBlindSpot) {
          blindSpotsThisAttempt.set(
            ans.topicId,
            (blindSpotsThisAttempt.get(ans.topicId) || 0) + 1
          );
        }
      }

      for (const [topicId, delta] of Object.entries(evalResult.masteryDeltas)) {
        // Recompute from persisted answers instead of incrementing a counter.
        // A retry after a partial write therefore cannot inflate blind-spot counts.
        const { data: blindSpotRows } = await admin
          .from("answers")
          .select("id")
          .eq("user_id", userId)
          .eq("topic_id", topicId)
          .eq("is_blind_spot", true);

        await admin
          .from("topics")
          .update({
            current_mastery: delta.current,
            classification: delta.classification,
            evidence_level: delta.evidenceLevel,
            total_attempts: delta.totalAttempts,
            correct_attempts: delta.correctAttempts,
            blind_spot_count: blindSpotRows?.length ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", topicId)
          .eq("workspace_id", workspaceId);

        await admin.from("mastery_snapshots").insert({
          workspace_id: workspaceId,
          topic_id: topicId,
          user_id: userId,
          quiz_id: quizId,
          mastery_score: delta.current,
          classification: delta.classification,
          evidence_level: delta.evidenceLevel,
          effective_attempts: delta.totalAttempts,
          recorded_at: new Date().toISOString(),
        });
      }

      await admin
        .from("quizzes")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          total_score: evalResult.totalScore,
          max_possible_score: evalResult.maxPossibleScore,
        })
        .eq("id", quizId)
        .eq("workspace_id", workspaceId);

      // Automatic re-planning: preserve completed history, replace pending work.
      try {
        const dependentCounts = new Map<string, number>();
        for (const p of prerequisites) {
          dependentCounts.set(
            p.prerequisite_topic_id,
            (dependentCounts.get(p.prerequisite_topic_id) || 0) + 1
          );
        }

        const rawFactors: RawTopicFactorsInput[] = topics.map((t) => ({
          topicId: t.id,
          topicTitle: t.title,
          masteryScore:
            evalResult.masteryDeltas[t.id]?.current ?? t.current_mastery ?? 45.0,
          examWeight: t.exam_weight ?? 0.0,
          blindSpotCount:
            (t.blind_spot_count ?? 0) + (blindSpotsThisAttempt.get(t.id) || 0),
          totalAttempts: t.total_attempts ?? 0,
          downstreamDependentsCount: dependentCounts.get(t.id) || 0,
          totalTopicsCount: topics.length,
        }));
        const prioritized = rankTopicsByPriority(rawFactors);

        const { data: planData } = await admin
          .from("revision_plans")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planData) {
          const { data: taskData } = await admin
            .from("revision_tasks")
            .select("*")
            .eq("plan_id", planData.id);

          const existingTasks: ScheduledTask[] = (taskData || []).map((t) => ({
            id: t.id,
            planId: t.plan_id,
            topicId: t.topic_id,
            topicTitle: (t.title || "").split(": ").slice(1).join(": ") || t.title,
            dayNumber: t.day_number,
            taskOrder: t.task_order,
            taskType: t.task_type,
            title: t.title,
            description: t.description || "",
            allocatedMinutes: t.allocated_minutes,
            priorityScore: t.priority_score,
            status: t.status,
            sourceChunkId: t.source_chunk_id,
            citationReference: t.citation_reference,
            completedAt: t.completed_at,
          }));

          const metadata = new Map(
            topics.map((t) => [
              t.id,
              {
                sourceChunkId: t.source_chunk_id,
                citationReference: t.unit_module ? `${t.unit_module}: ${t.title}` : t.title,
              },
            ])
          );

          const updatedPlan = updatePlanAfterRetest({
            existingPlan: {
              id: planData.id,
              workspaceId,
              version: planData.version,
              examDate: planData.exam_date,
              dailyMinutes: planData.daily_minutes,
              totalDays: planData.total_days,
              totalAllocatedMinutes: planData.total_allocated_minutes,
              totalAvailableMinutes: planData.total_days * planData.daily_minutes,
              completedMinutes: 0,
              isActive: true,
              days: [],
              deferredTasksCount: 0,
            },
            prioritizedTopics: prioritized,
            topicMetadataMap: metadata,
          });

          await admin
            .from("revision_tasks")
            .delete()
            .eq("plan_id", planData.id)
            .eq("status", "pending");

          for (const day of updatedPlan.days) {
            for (const task of day.tasks) {
              if (task.status !== "pending") continue;
              await admin.from("revision_tasks").insert({
                id: task.id,
                plan_id: planData.id,
                workspace_id: workspaceId,
                topic_id: task.topicId,
                day_number: task.dayNumber,
                task_order: task.taskOrder,
                task_type: task.taskType,
                title: task.title,
                description: task.description,
                allocated_minutes: task.allocatedMinutes,
                priority_score: task.priorityScore,
                status: task.status,
                source_chunk_id: task.sourceChunkId,
                citation_reference: task.citationReference,
              });
            }
          }

          await admin
            .from("revision_plans")
            .update({
              version: updatedPlan.version,
              total_allocated_minutes: updatedPlan.totalAllocatedMinutes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", planData.id);

          planUpdated = true;
        }
      } catch (replanError) {
        planWarning =
          "Assessment saved, but the revision plan could not be refreshed automatically.";
        console.error("[Quiz Evaluate] Plan refresh failed:", replanError);
      }
    }

    return NextResponse.json({
      success: true,
      isDemo: auth.isDemo,
      persisted: isLiveDb,
      planUpdated,
      planWarning,
      ...evalResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to evaluate quiz", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
