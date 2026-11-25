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
import { isMissingSchemaError } from "@/lib/supabase/errors";
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
import { getDemoQuizQuestions } from "@/lib/demo/demo-quiz-cache";

const AnswerSubmissionSchema = z.object({
  questionId: z.string(),
  response: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  questionText: z.string().optional(),
  questionType: z.enum(["mcq", "short_answer"]).optional(),
  options: z.any().optional(),
  topicId: z.string().optional(),
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
    let isSchemaMissing = false;
    const admin = getSupabaseAdmin();
    const userId = auth.userId;
    const submittedIds = answers.map((a) => a.questionId);

    let questions: QuizQuestionRow[] = [];
    let topics: TopicRow[] = [];
    let prerequisites: TopicPrerequisiteRow[] = [];
    const currentMasteryMap = new Map<string, number>();
    const historicalAttemptsMap = new Map<string, Array<{ score: number; difficulty: number }>>();

    if (isLiveDb) {
      if (new Set(submittedIds).size !== submittedIds.length) {
        return NextResponse.json(
          { error: "Each quiz question may be submitted only once." },
          { status: 400 }
        );
      }

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

      const { data: allQuizQuestions, error: allQuestionsError } = await admin
        .from("quiz_questions")
        .select("id")
        .eq("quiz_id", quizId);

      if (allQuestionsError) {
        if (isMissingSchemaError(allQuestionsError)) {
          isSchemaMissing = true;
        } else {
          return NextResponse.json(
            { error: "Failed to load quiz questions.", details: allQuestionsError.message },
            { status: 500 }
          );
        }
      }

      if (isSchemaMissing) {
        const cached = getDemoQuizQuestions(quizId);
        if (cached && cached.length > 0) {
          questions = cached.filter((q) => submittedIds.includes(q.id));
        }
        if (questions.length !== submittedIds.length) {
          return NextResponse.json(
            { error: `Invalid or expired quiz session (${quizId}). Please generate a fresh diagnostic quiz.` },
            { status: 400 }
          );
        }
        for (const a of answers) {
          if (a.topicId && !currentMasteryMap.has(a.topicId)) {
            currentMasteryMap.set(a.topicId, 45.0);
          }
        }
      } else {
        const allQuestionIds = (allQuizQuestions || []).map((q) => q.id);
        const submittedQuestionIds = new Set(submittedIds);
        const missingQuestionIds = allQuestionIds.filter((id) => !submittedQuestionIds.has(id));

        if (missingQuestionIds.length > 0) {
          return NextResponse.json(
            {
              error: "Submit every question in the quiz before finalizing the assessment.",
              missingQuestionIds,
            },
            { status: 400 }
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
            .select("quiz_id, quiz_question_id, topic_id, score, answered_at")
            .eq("user_id", userId)
            .in("topic_id", topicIds)
            .order("answered_at", { ascending: true });

          if (prevAnswers) {
            const previousQuestionIds = Array.from(
              new Set(
                prevAnswers
                  .map((pa) => pa.quiz_question_id)
                  .filter((id): id is string => Boolean(id))
              )
            );
            const difficultyMap = new Map<string, number>();

            if (previousQuestionIds.length > 0) {
              const { data: previousQuestions } = await admin
                .from("quiz_questions")
                .select("id, difficulty")
                .in("id", previousQuestionIds);

              for (const question of previousQuestions || []) {
                difficultyMap.set(question.id, question.difficulty);
              }
            }

            for (const pa of prevAnswers) {
              if (pa.quiz_id === quizId) continue;
              const list = historicalAttemptsMap.get(pa.topic_id) || [];
              list.push({
                score: pa.score ?? 0,
                difficulty: difficultyMap.get(pa.quiz_question_id) ?? 2,
              });
              historicalAttemptsMap.set(pa.topic_id, list);
            }
          }
        }
      }
    } else {
      // Offline mode: demo quiz accepts fixture questions or cached dynamically-generated questions
      if (quizId === DEMO_QUIZ_QUESTIONS[0].quiz_id) {
        questions = DEMO_QUIZ_QUESTIONS.filter((q) => submittedIds.includes(q.id));
        if (questions.length !== submittedIds.length) {
          const missing = submittedIds.filter((id) => !questions.some((q) => q.id === id));
          return NextResponse.json(
            {
              error: `Submitted questions do not belong to this demo quiz: ${missing.join(", ")}`,
              isDemo: true,
            },
            { status: 400 }
          );
        }
      } else {
        const cached = getDemoQuizQuestions(quizId);
        if (cached && cached.length > 0) {
          questions = cached.filter((q) => submittedIds.includes(q.id));
          if (questions.length !== submittedIds.length) {
            const missing = submittedIds.filter((id) => !questions.some((q) => q.id === id));
            return NextResponse.json(
              {
                error: `Submitted question IDs not found in generated quiz session: ${missing.join(", ")}`,
                isDemo: true,
              },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            {
              error: `Invalid or expired quiz session (${quizId}). Please generate or start a fresh diagnostic quiz.`,
              isDemo: true,
            },
            { status: 400 }
          );
        }
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

    if (isLiveDb && !isSchemaMissing) {
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
      const attemptCountsThisAttempt = new Map<string, number>();
      for (const ans of evalResult.answers) {
        attemptCountsThisAttempt.set(
          ans.topicId,
          (attemptCountsThisAttempt.get(ans.topicId) || 0) + 1
        );
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

        const { error: topicUpdateError } = await admin
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

        if (topicUpdateError) {
          return NextResponse.json(
            { error: "Failed to update topic mastery.", details: topicUpdateError.message },
            { status: 500 }
          );
        }

        const { data: existingSnapshot, error: snapshotLookupError } = await admin
          .from("mastery_snapshots")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("topic_id", topicId)
          .eq("quiz_id", quizId)
          .maybeSingle();

        if (snapshotLookupError) {
          return NextResponse.json(
            { error: "Failed to check mastery history.", details: snapshotLookupError.message },
            { status: 500 }
          );
        }

        if (!existingSnapshot) {
          const { error: snapshotInsertError } = await admin.from("mastery_snapshots").insert({
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

          if (snapshotInsertError) {
            return NextResponse.json(
              { error: "Failed to record mastery history.", details: snapshotInsertError.message },
              { status: 500 }
            );
          }
        }
      }

      const { error: quizCompleteError } = await admin
        .from("quizzes")
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
          total_score: evalResult.totalScore,
          max_possible_score: evalResult.maxPossibleScore,
        })
        .eq("id", quizId)
        .eq("workspace_id", workspaceId);

      if (quizCompleteError) {
        return NextResponse.json(
          { error: "Failed to finalize quiz submission.", details: quizCompleteError.message },
          { status: 500 }
        );
      }

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
          totalAttempts:
            evalResult.masteryDeltas[t.id]?.totalAttempts ?? ((t.total_attempts ?? 0) + (attemptCountsThisAttempt.get(t.id) || 0)),
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

          const { error: deleteTasksError } = await admin
            .from("revision_tasks")
            .delete()
            .eq("plan_id", planData.id)
            .eq("status", "pending");

          if (deleteTasksError) {
            throw new Error(`Failed to clear pending revision tasks: ${deleteTasksError.message}`);
          }

          for (const day of updatedPlan.days) {
            for (const task of day.tasks) {
              if (task.status !== "pending") continue;

              const { error: taskInsertError } = await admin.from("revision_tasks").insert({
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

              if (taskInsertError) {
                throw new Error(`Failed to save refreshed revision task: ${taskInsertError.message}`);
              }
            }
          }

          const { error: planUpdateError } = await admin
            .from("revision_plans")
            .update({
              version: updatedPlan.version,
              total_allocated_minutes: updatedPlan.totalAllocatedMinutes,
              updated_at: new Date().toISOString(),
            })
            .eq("id", planData.id);

          if (planUpdateError) {
            throw new Error(`Failed to update refreshed revision plan: ${planUpdateError.message}`);
          }

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
