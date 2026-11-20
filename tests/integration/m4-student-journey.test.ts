// ==============================================================================
// M4 Integration: Student journey across Diagnostic, Gap Report, Planner, Copilot
// Exercises the real API routes plus the pure state merge used by the UI.
// Browser automation is intentionally out of scope for this phase.
// ==============================================================================

import { beforeAll, describe, expect, it } from "vitest";
import { POST as evaluateQuiz } from "@/app/api/quiz/evaluate/route";
import { POST as copilotChat } from "@/app/api/copilot/chat/route";
import { mergeAssessmentIntoGapReport } from "@/lib/algorithms/gap-report-update";
import { rankTopicsByPriority } from "@/lib/algorithms/priority";
import { updatePlanAfterRetest } from "@/lib/algorithms/scheduler";
import { CLIENT_DEMO_GAP_REPORT } from "@/lib/demo/client-gap-report";
import {
  DEMO_PREREQUISITES,
  DEMO_REVISION_SCHEDULE,
  DEMO_TOPICS,
} from "@/lib/demo/os-cs301-fixture";
import type { AssessmentTopicResult } from "@/types/assessment";
import type { ScheduledTask } from "@/types/planner";

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const QUIZ_ID = "70000000-0000-0000-0000-000000000001";
const WRONG_TOPIC_ID = "40000000-0000-0000-0000-000000000006";

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

async function runDiagnostic() {
  const res = await evaluateQuiz(
    new Request("http://localhost:3000/api/quiz/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: QUIZ_ID,
        workspaceId: WORKSPACE_ID,
        answers: [
          {
            questionId: "80000000-0000-0000-0000-000000000001",
            response: "C",
            confidence: "high",
          },
          {
            questionId: "80000000-0000-0000-0000-000000000002",
            response: "A TLB miss and a page fault are both handled by the OS kernel from disk.",
            confidence: "medium",
          },
          {
            questionId: "80000000-0000-0000-0000-000000000003",
            response: "A",
            confidence: "high",
          },
        ],
      }),
    })
  );
  expect(res.status).toBe(200);
  return res.json();
}

describe("M4 journey: diagnostic -> gap report -> planner -> copilot", () => {
  it("turns a high-confidence error into gap-report insight and a reordered plan", async () => {
    const evaluation = await runDiagnostic();
    const wrongAnswer = evaluation.answers.find(
      (answer: any) => answer.questionId === "80000000-0000-0000-0000-000000000003"
    );
    expect(wrongAnswer.isBlindSpot).toBe(true);

    const topicResults: AssessmentTopicResult[] = Object.entries(
      evaluation.masteryDeltas
    ).map(([topicId, delta]: [string, any]) => ({
      topicId,
      masteryScore: delta.current,
      classification: delta.classification,
      evidenceLevel: delta.evidenceLevel,
      totalAttempts: delta.totalAttempts,
      correctAttempts: delta.correctAttempts,
      isBlindSpot: topicId === WRONG_TOPIC_ID,
      blindSpot:
        topicId === WRONG_TOPIC_ID
          ? {
              topicId,
              topicTitle: "Deadlock Avoidance & Banker's Algorithm",
              questionId: wrongAnswer.questionId,
              questionText: "In Dijkstra's Banker's Algorithm, what defines a 'safe state'?",
              studentResponse: "A",
              correctAnswer: wrongAnswer.correctAnswer,
              confidence: "high",
              evidenceQuote: wrongAnswer.citation.quote,
              citation: wrongAnswer.citation,
              remedyAction: "Review the safe-state definition and re-test.",
            }
          : undefined,
    }));

    const updatedReport = mergeAssessmentIntoGapReport(
      CLIENT_DEMO_GAP_REPORT,
      topicResults
    );
    expect(updatedReport.blindSpots.totalBlindSpots).toBe(1);
    expect(updatedReport.blindSpots.items[0].questionId).toBe(wrongAnswer.questionId);
    expect(updatedReport.topics.find((t) => t.topicId === WRONG_TOPIC_ID)!.blindSpotCount).toBe(1);

    const mergedTopics = DEMO_TOPICS.map((topic) => {
      const result = topicResults.find((r) => r.topicId === topic.id);
      return result
        ? { ...topic, current_mastery: result.masteryScore, classification: result.classification }
        : topic;
    });

    const dependentCounts = new Map<string, number>();
    for (const prerequisite of DEMO_PREREQUISITES) {
      dependentCounts.set(
        prerequisite.prerequisite_topic_id,
        (dependentCounts.get(prerequisite.prerequisite_topic_id) || 0) + 1
      );
    }

    const prioritized = rankTopicsByPriority(
      mergedTopics.map((topic) => ({
        topicId: topic.id,
        topicTitle: topic.title,
        masteryScore: topic.current_mastery,
        examWeight: topic.exam_weight,
        blindSpotCount:
          topic.id === WRONG_TOPIC_ID
            ? 1
            : topic.blind_spot_count,
        totalAttempts: topic.total_attempts + 1,
        downstreamDependentsCount: dependentCounts.get(topic.id) || 0,
        totalTopicsCount: mergedTopics.length,
      }))
    );

    const metadata = new Map(
      mergedTopics.map((topic) => [
        topic.id,
        {
          sourceChunkId: topic.source_chunk_id,
          citationReference: topic.unit_module
            ? `${topic.unit_module}: ${topic.title}`
            : topic.title,
        },
      ])
    );

    const plan = updatePlanAfterRetest({
      existingPlan: DEMO_REVISION_SCHEDULE,
      prioritizedTopics: prioritized,
      topicMetadataMap: metadata,
    });

    expect(plan.version).toBeGreaterThan(DEMO_REVISION_SCHEDULE.version);
    for (const day of plan.days) {
      expect(day.allocatedMinutes).toBeLessThanOrEqual(day.availableMinutes);
      for (const task of day.tasks as ScheduledTask[]) {
        expect(task.allocatedMinutes).toBeGreaterThan(0);
      }
    }
    // The refreshed plan must contain pending work for the newly failed topic.
    const pendingTasks = plan.days
      .flatMap((day) => day.tasks)
      .filter((task) => task.status === "pending");
    expect(pendingTasks.length).toBeGreaterThan(0);
    expect(pendingTasks.some((task) => task.topicId === WRONG_TOPIC_ID)).toBe(true);
  });

  it("answers a grounded Copilot query with a citation and refuses out-of-scope questions", async () => {
    const groundedRes = await copilotChat(
      new Request("http://localhost:3000/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          message: "How does demand paging resolve a page fault?",
        }),
      })
    );
    expect(groundedRes.status).toBe(200);
    const grounded = await groundedRes.json();
    expect(grounded.isRefusal).toBe(false);
    expect(grounded.answer.length).toBeGreaterThan(20);
    expect(grounded.citations.length).toBeGreaterThan(0);
    expect(grounded.citations[0].isQuoteVerified).toBe(true);

    const refusalRes = await copilotChat(
      new Request("http://localhost:3000/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: WORKSPACE_ID,
          message: "What is the best recipe for chocolate ice cream?",
        }),
      })
    );
    expect(refusalRes.status).toBe(200);
    const refusal = await refusalRes.json();
    expect(refusal.isRefusal).toBe(true);
    expect(refusal.citations).toHaveLength(0);
    expect(refusal.answer).toContain("does not provide sufficient information");
  });
});
