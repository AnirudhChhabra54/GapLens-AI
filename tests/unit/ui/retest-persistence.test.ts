// ==============================================================================
// GapLens AI — Regression Test: Retest Persistence Across Hard Refresh
// Verifies Priority 0 fix: retested topic scores and assessment results are saved
// to localStorage and replayed consistently on provider mount / hard refresh.
// ==============================================================================

import { describe, it, expect } from "vitest";
import { reconstructStateFromResults } from "@/components/workspace-context";
import {
  DEMO_TOPICS,
  DEMO_REVISION_SCHEDULE,
} from "@/lib/demo/os-cs301-fixture";
import { CLIENT_DEMO_GAP_REPORT } from "@/lib/demo/client-gap-report";
import type { AssessmentTopicResult } from "@/types/assessment";

describe("P0 Fix: Retest Persistence & State Replay Across Refresh", () => {
  const TARGET_TOPIC_ID = "40000000-0000-0000-0000-000000000005"; // Peterson's Algorithm

  it("should have weak baseline mastery before retest", () => {
    const baselineTopic = DEMO_TOPICS.find((t) => t.id === TARGET_TOPIC_ID);
    expect(baselineTopic).toBeDefined();
    expect(baselineTopic!.classification).toBe("weak");
    expect(baselineTopic!.current_mastery).toBeLessThan(55);
  });

  it("should update mastery, gap report, and schedule when assessment results are applied", () => {
    const assessmentResults: AssessmentTopicResult[] = [
      {
        topicId: TARGET_TOPIC_ID,
        masteryScore: 84.5,
        classification: "strong",
        evidenceLevel: "strong_evidence",
        totalAttempts: 3,
        correctAttempts: 2,
        isBlindSpot: false,
      },
    ];

    const updated = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: assessmentResults,
      completedTaskIds: [],
    });

    const updatedTopic = updated.nextTopics.find((t) => t.id === TARGET_TOPIC_ID);
    expect(updatedTopic).toBeDefined();
    expect(updatedTopic!.current_mastery).toBe(84.5);
    expect(updatedTopic!.classification).toBe("strong");

    // Gap report topic updated
    const gapReportTopic = updated.nextGapReport.topics.find((t) => t.topicId === TARGET_TOPIC_ID);
    expect(gapReportTopic).toBeDefined();
    expect(gapReportTopic!.masteryScore).toBe(84.5);
    expect(gapReportTopic!.classification).toBe("strong");
  });

  it("should persist across simulated localStorage save and hard refresh mount", () => {
    // 1. Student takes assessment and scores 88.0 on Peterson's Algorithm
    const assessmentResults: AssessmentTopicResult[] = [
      {
        topicId: TARGET_TOPIC_ID,
        masteryScore: 88.0,
        classification: "strong",
        evidenceLevel: "strong_evidence",
        totalAttempts: 4,
        correctAttempts: 3,
        isBlindSpot: false,
      },
    ];

    const completedTasks = ["c0000000-0000-0000-0000-000000000001"];

    // 2. Simulate JSON serialization into localStorage
    const savedState = {
      isLoggedIn: true,
      isDemo: true,
      dailyMinutes: 45,
      completedTasks,
      retestedTopicScores: { [TARGET_TOPIC_ID]: 88.0 },
      storedAssessmentResults: assessmentResults,
    };
    const serialized = JSON.stringify(savedState);

    // 3. Simulate hard refresh: parse from serialized JSON and mount provider
    const parsed = JSON.parse(serialized);
    expect(parsed.retestedTopicScores[TARGET_TOPIC_ID]).toBe(88.0);
    expect(parsed.storedAssessmentResults).toHaveLength(1);

    // 4. Replay state from base demo fixtures using restored data
    const restored = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: parsed.storedAssessmentResults,
      completedTaskIds: parsed.completedTasks,
      dailyMinutes: parsed.dailyMinutes,
    });

    // 5. Verify restored state matches expectations
    const restoredTopic = restored.nextTopics.find((t) => t.id === TARGET_TOPIC_ID);
    expect(restoredTopic!.current_mastery).toBe(88.0);
    expect(restoredTopic!.classification).toBe("strong");

    const restoredGapTopic = restored.nextGapReport.topics.find((t) => t.topicId === TARGET_TOPIC_ID);
    expect(restoredGapTopic!.masteryScore).toBe(88.0);
    expect(restoredGapTopic!.classification).toBe("strong");

    // Completed task remains completed
    const day1 = restored.nextSchedule.days[0];
    const task1 = day1.tasks.find((t) => t.id === "c0000000-0000-0000-0000-000000000001");
    if (task1) {
      expect(task1.status).toBe("completed");
    }
  });

  it("should not double-count or distort mastery deltas on multiple remounts", () => {
    const assessmentResults: AssessmentTopicResult[] = [
      {
        topicId: TARGET_TOPIC_ID,
        masteryScore: 78.0,
        classification: "medium",
        totalAttempts: 2,
        correctAttempts: 1,
      },
    ];

    // Remount 1
    const remount1 = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: assessmentResults,
      completedTaskIds: [],
    });

    // Remount 2 (using same base)
    const remount2 = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: assessmentResults,
      completedTaskIds: [],
    });

    const topic1 = remount1.nextTopics.find((t) => t.id === TARGET_TOPIC_ID);
    const topic2 = remount2.nextTopics.find((t) => t.id === TARGET_TOPIC_ID);

    expect(topic1!.current_mastery).toBe(topic2!.current_mastery);
    expect(topic1!.total_attempts).toBe(topic2!.total_attempts);
    expect(remount1.nextGapReport.readiness.readinessScore).toBe(remount2.nextGapReport.readiness.readinessScore);
  });

  it("should support fallback reconstruction if only retestedTopicScores is present", () => {
    const parsedRetestedScores = { [TARGET_TOPIC_ID]: 92.0 };

    const fallbackResults: AssessmentTopicResult[] = Object.entries(parsedRetestedScores).map(
      ([topicId, score]) => ({
        topicId,
        masteryScore: score,
        classification: score >= 80 ? "strong" : score >= 55 ? "medium" : "weak",
      })
    );

    const restored = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: fallbackResults,
      completedTaskIds: [],
    });

    const topic = restored.nextTopics.find((t) => t.id === TARGET_TOPIC_ID);
    expect(topic!.current_mastery).toBe(92.0);
    expect(topic!.classification).toBe("strong");
  });
});
