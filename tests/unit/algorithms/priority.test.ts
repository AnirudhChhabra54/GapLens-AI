// ==============================================================================
// Unit Test: Topic Revision Priority Engine
// Verifies multi-factor priority scoring (deficit, exam weight, blind spot, prereq),
// dynamic weight renormalization when past papers are missing, and deterministic tie-breaking.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  computeTopicPriority,
  renormalizePriorityWeights,
  rankTopicsByPriority,
  DEFAULT_PRIORITY_WEIGHTS,
} from "@/lib/algorithms/priority";

describe("Unit: Topic Revision Priority Engine (priority.ts)", () => {
  describe("Default Weights & Renormalization", () => {
    it("should have correct standard default priority weights", () => {
      expect(DEFAULT_PRIORITY_WEIGHTS.wDeficit).toBe(0.45);
      expect(DEFAULT_PRIORITY_WEIGHTS.wExam).toBe(0.25);
      expect(DEFAULT_PRIORITY_WEIGHTS.wBlind).toBe(0.15);
      expect(DEFAULT_PRIORITY_WEIGHTS.wPrereq).toBe(0.15);
      const sum =
        DEFAULT_PRIORITY_WEIGHTS.wDeficit +
        DEFAULT_PRIORITY_WEIGHTS.wExam +
        DEFAULT_PRIORITY_WEIGHTS.wBlind +
        DEFAULT_PRIORITY_WEIGHTS.wPrereq;
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("should dynamically renormalize weights when past papers are absent (wExam = 0)", () => {
      const weights = renormalizePriorityWeights({
        hasPastPapers: false,
        hasPrerequisites: true,
      });

      expect(weights.wExam).toBe(0.0);
      expect(weights.wDeficit).toBeCloseTo(0.60, 2); // 0.45 / 0.75
      expect(weights.wBlind).toBeCloseTo(0.20, 2); // 0.15 / 0.75
      expect(weights.wPrereq).toBeCloseTo(0.20, 2); // 0.15 / 0.75

      const sum = weights.wDeficit + weights.wExam + weights.wBlind + weights.wPrereq;
      expect(sum).toBeCloseTo(1.0, 4);
    });

    it("should dynamically renormalize when both past papers and prerequisites are absent", () => {
      const weights = renormalizePriorityWeights({
        hasPastPapers: false,
        hasPrerequisites: false,
      });

      expect(weights.wExam).toBe(0.0);
      expect(weights.wPrereq).toBe(0.0);
      expect(weights.wDeficit).toBeCloseTo(0.75, 2); // 0.45 / 0.60
      expect(weights.wBlind).toBeCloseTo(0.25, 2); // 0.15 / 0.60

      const sum = weights.wDeficit + weights.wBlind;
      expect(sum).toBeCloseTo(1.0, 4);
    });
  });

  describe("Single Topic Priority Calculation", () => {
    it("should calculate transparent multi-factor priority score", () => {
      const factors = computeTopicPriority(
        {
          topicId: "t-1",
          topicTitle: "Virtual Memory",
          masteryScore: 38.0, // deficit = 0.62
          examWeight: 0.20,
          blindSpotCount: 1,
          totalAttempts: 2, // blindSpotRisk = 0.50
          downstreamDependentsCount: 3,
          totalTopicsCount: 10, // prereqImpact = 3 / 9 = 0.3333
        },
        DEFAULT_PRIORITY_WEIGHTS
      );

      expect(factors.masteryDeficit).toBeCloseTo(0.62, 2);
      expect(factors.examWeight).toBe(0.20);
      expect(factors.blindSpotRisk).toBe(0.50);
      expect(factors.prerequisiteImpact).toBeCloseTo(0.3333, 2);

      // (0.62 * 0.45 + 0.20 * 0.25 + 0.50 * 0.15 + 0.3333 * 0.15) * 100
      // = (0.279 + 0.05 + 0.075 + 0.05) * 100 = 45.4
      expect(factors.priorityScore).toBeGreaterThan(40);
      expect(factors.priorityScore).toBeLessThan(60);
    });

    it("should clamp factors and priority score strictly in [0, 100]", () => {
      // 100% mastery, 0 exam weight, 0 blind spots, 0 prereqs
      const lowPriority = computeTopicPriority({
        topicId: "t-low",
        topicTitle: "I/O Hardware",
        masteryScore: 100.0,
        examWeight: 0,
        blindSpotCount: 0,
        totalAttempts: 5,
        downstreamDependentsCount: 0,
        totalTopicsCount: 10,
      });

      expect(lowPriority.priorityScore).toBe(0.0);

      // 0% mastery, max exam weight, max blind spots, max prereqs
      const highPriority = computeTopicPriority({
        topicId: "t-high",
        topicTitle: "Processes & Threads",
        masteryScore: 0.0,
        examWeight: 1.0,
        blindSpotCount: 5,
        totalAttempts: 5,
        downstreamDependentsCount: 9,
        totalTopicsCount: 10,
      });

      expect(highPriority.priorityScore).toBe(100.0);
    });
  });

  describe("Ranking and Deterministic Tie-Breaking", () => {
    it("should rank topics in descending order of priority score", () => {
      const topics = [
        { topicId: "1", topicTitle: "Low Deficit", masteryScore: 90.0 },
        { topicId: "2", topicTitle: "High Deficit", masteryScore: 20.0 },
        { topicId: "3", topicTitle: "Medium Deficit", masteryScore: 60.0 },
      ];

      const ranked = rankTopicsByPriority(topics);

      expect(ranked[0].topicId).toBe("2");
      expect(ranked[1].topicId).toBe("3");
      expect(ranked[2].topicId).toBe("1");
    });

    it("should break ties deterministically using alphabetical topicTitle ASC", () => {
      const topicA = { topicId: "id-b", topicTitle: "Beta Topic", masteryScore: 50.0 };
      const topicB = { topicId: "id-a", topicTitle: "Alpha Topic", masteryScore: 50.0 };

      const ranked = rankTopicsByPriority([topicA, topicB]);

      expect(ranked[0].priorityScore).toBe(ranked[1].priorityScore);
      expect(ranked[0].topicTitle).toBe("Alpha Topic");
      expect(ranked[1].topicTitle).toBe("Beta Topic");
    });
  });
});
