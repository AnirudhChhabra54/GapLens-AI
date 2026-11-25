// ==============================================================================
// Unit Test: Part 4 Innovations (Exam ROI Optimizer & Semantic Confusion Pairs)
// ==============================================================================

import { describe, it, expect } from "vitest";
import { computeExamRoiRankings } from "@/lib/algorithms/exam-roi";
import { detectConfusionPairs } from "@/lib/algorithms/confusion-pairs";
import { DEMO_TOPICS } from "@/lib/demo/os-cs301-fixture";
import type { TopicMastery } from "@/types/assessment";

describe("Unit: Exam ROI (ΔMarks / Hour) Optimizer", () => {
  it("ranks high-weight weak topics above mastered low-weight topics", () => {
    const rankings = computeExamRoiRankings(DEMO_TOPICS);
    expect(rankings.length).toBe(DEMO_TOPICS.length);
    expect(rankings[0].expectedMarksGainPerHour).toBeGreaterThanOrEqual(
      rankings[rankings.length - 1].expectedMarksGainPerHour
    );
  });
});

describe("Unit: Semantic Confusion Pair Detector", () => {
  it("identifies closely related topic pairs with active mastery risk", () => {
    const topics: TopicMastery[] = [
      {
        topicId: "t1",
        topicTitle: "TLB Miss Handling",
        unitModule: "Virtual Memory",
        masteryScore: 38,
        classification: "weak",
        evidenceLevel: "early_signal",
        totalAttempts: 2,
        correctAttempts: 0,
        blindSpotCount: 1,
        examWeight: 0.25,
        examFrequency: 3,
        lastAttemptAt: null,
      },
      {
        topicId: "t2",
        topicTitle: "Page Fault Handling",
        unitModule: "Virtual Memory",
        masteryScore: 72,
        classification: "medium",
        evidenceLevel: "developing_evidence",
        totalAttempts: 3,
        correctAttempts: 2,
        blindSpotCount: 0,
        examWeight: 0.25,
        examFrequency: 3,
        lastAttemptAt: null,
      },
    ];

    const pairs = detectConfusionPairs(topics, 2);
    expect(pairs.length).toBe(1);
    expect(pairs[0].similarityScore).toBeGreaterThan(0.1);
  });
});
