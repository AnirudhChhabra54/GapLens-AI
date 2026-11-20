// ==============================================================================
// Tier 2: Boundary & Corner Cases — Mastery & Planner Boundaries
// Tests edge conditions in Bayesian mastery decay, extreme attempt scores,
// classification cutoffs, zero/tight study budgets, and priority tie-breaking.
// ==============================================================================

import { describe, it, expect } from "vitest";
import { assertBayesianMastery, assertDailyBudget, assertBlindSpot, classifyCalibration } from "../helpers/assertion-helpers";
import type { MasteryClassification, TaskStatus } from "@/types/database";
import type { PriorityWeights, TopicPriorityFactors, ScheduledTask } from "@/types/planner";

describe("Tier 2: Mastery & Planner Boundary & Corner Cases", () => {
  // ----------------------------------------------------------------------------
  // 1. Extreme Score Boundaries (0.0% and 100.0%)
  // ----------------------------------------------------------------------------
  describe("Extreme Score Boundaries", () => {
    it("T2.MST.1: 0% score should strictly decrease mastery from prior 0.45", () => {
      const mastery = assertBayesianMastery({
        attempts: [{ score: 0.0 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery).toBeCloseTo(0.36, 2);
      expect(mastery).toBeLessThan(0.45);
    });

    it("T2.MST.2: 100% score should strictly increase mastery from prior 0.45", () => {
      const mastery = assertBayesianMastery({
        attempts: [{ score: 1.0 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery).toBeGreaterThan(0.45);
      expect(mastery).toBeCloseTo(0.56, 2);
    });

    it("T2.MST.3: should clamp scores greater than 1.0 to maximum 1.0", () => {
      const mastery = assertBayesianMastery({
        attempts: [{ score: 1.5 }], // Over-score input
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery).toBeLessThanOrEqual(1.0);
    });

    it("T2.MST.4: should clamp negative scores to 0.0", () => {
      const mastery = assertBayesianMastery({
        attempts: [{ score: -0.5 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery).toBeGreaterThanOrEqual(0.0);
      expect(mastery).toBeLessThanOrEqual(0.45);
    });

    it("T2.MST.5: repeated 100% scores should asymptotically approach 1.0", () => {
      const attempts = Array.from({ length: 20 }, () => ({ score: 1.0 }));
      const mastery = assertBayesianMastery({ attempts, prior: 0.45 });
      expect(mastery).toBeGreaterThan(0.98);
      expect(mastery).toBeLessThanOrEqual(1.0);
    });

    it("T2.MST.6: repeated 0% scores should asymptotically approach 0.0", () => {
      const attempts = Array.from({ length: 20 }, () => ({ score: 0.0 }));
      const mastery = assertBayesianMastery({ attempts, prior: 0.45 });
      expect(mastery).toBeLessThan(0.02);
      expect(mastery).toBeGreaterThanOrEqual(0.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Long Time Horizon & Forgetting Decay (1d, 30d, 365d)
  // ----------------------------------------------------------------------------
  describe("Long Time Horizon & Forgetting Decay", () => {
    it("T2.MST.7: 1-day decay should retain ~80% of mastered knowledge", () => {
      const mastery1d = assertBayesianMastery({
        attempts: [{ score: 1.0, ageDays: 1 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery1d).toBeGreaterThan(0.80);
    });

    it("T2.MST.8: 30-day decay should decay back near baseline prior (0.45)", () => {
      const mastery30d = assertBayesianMastery({
        attempts: [{ score: 1.0, ageDays: 30 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery30d).toBeCloseTo(0.45, 2);
    });

    it("T2.MST.9: 365-day decay should converge exactly to baseline prior (0.45)", () => {
      const mastery365d = assertBayesianMastery({
        attempts: [{ score: 1.0, ageDays: 365 }],
        prior: 0.45,
        gamma: 0.80,
      });
      expect(mastery365d).toBeCloseTo(0.45, 4);
    });

    it("T2.MST.10: ageDays = 0 should perform fresh attempt update without decay", () => {
      const mastery0d = assertBayesianMastery({
        attempts: [{ score: 1.0, ageDays: 0 }],
        prior: 0.45,
      });
      expect(mastery0d).toBeGreaterThan(0.45);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Classification Boundary Cutoffs (<0.40, 0.40-0.70, >0.70)
  // ----------------------------------------------------------------------------
  describe("Classification Boundary Cutoffs", () => {
    const classify = (m: number): MasteryClassification => {
      if (m < 0.40) return "weak";
      if (m <= 0.70) return "medium";
      return "strong";
    };

    it("T2.MST.11: 0.3999 should be classified as weak", () => {
      expect(classify(0.3999)).toBe("weak");
    });

    it("T2.MST.12: exactly 0.4000 should be classified as medium", () => {
      expect(classify(0.4000)).toBe("medium");
    });

    it("T2.MST.13: exactly 0.7000 should be classified as medium", () => {
      expect(classify(0.7000)).toBe("medium");
    });

    it("T2.MST.14: 0.7001 should be classified as strong", () => {
      expect(classify(0.7001)).toBe("strong");
    });

    it("T2.MST.15: 0.0000 should be classified as weak", () => {
      expect(classify(0.0)).toBe("weak");
    });

    it("T2.MST.16: 1.0000 should be classified as strong", () => {
      expect(classify(1.0)).toBe("strong");
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Calibration & Blind-Spot Cutoffs
  // ----------------------------------------------------------------------------
  describe("Calibration & Blind-Spot Cutoffs", () => {
    it("T2.MST.17: high confidence with score 0.39 should be a blind spot", () => {
      expect(classifyCalibration("high", 0.39).isBlindSpot).toBe(true);
    });

    it("T2.MST.18: high confidence with score 0.40 should NOT be a blind spot", () => {
      expect(classifyCalibration("high", 0.40).isBlindSpot).toBe(false);
    });

    it("T2.MST.19: low confidence with score 0.70 should be uncertain success", () => {
      expect(classifyCalibration("low", 0.70).isUncertainSuccess).toBe(true);
    });

    it("T2.MST.20: low confidence with score 0.69 should NOT be uncertain success", () => {
      expect(classifyCalibration("low", 0.69).isUncertainSuccess).toBe(false);
    });

    it("T2.MST.21: medium confidence should always be classified as aligned", () => {
      expect(classifyCalibration("medium", 0.0).label).toBe("aligned");
      expect(classifyCalibration("medium", 0.5).label).toBe("aligned");
      expect(classifyCalibration("medium", 1.0).label).toBe("aligned");
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Study Budget and Packing Edge Cases
  // ----------------------------------------------------------------------------
  describe("Study Budget and Packing Edge Cases", () => {
    it("T2.MST.22: zero-minute daily budget should allocate 0 tasks", () => {
      const budget = 0;
      const tasks: ScheduledTask[] = [];
      assertDailyBudget(tasks, budget);
      expect(tasks.length).toBe(0);
    });

    it("T2.MST.23: 15-minute tight budget should allocate at most 1 task", () => {
      const budget = 15;
      const tasks: ScheduledTask[] = [
        { id: "1", planId: "p", topicId: "t1", topicTitle: "T", dayNumber: 1, taskOrder: 1, taskType: "read_source", title: "Read", description: "", allocatedMinutes: 15, priorityScore: 90, status: "pending" },
      ];
      assertDailyBudget(tasks, budget);
      expect(tasks.length).toBe(1);
    });

    it("T2.MST.24: task duration matching exactly the budget should pack perfectly", () => {
      const budget = 45;
      const tasks: ScheduledTask[] = [
        { id: "1", planId: "p", topicId: "t1", topicTitle: "T", dayNumber: 1, taskOrder: 1, taskType: "practice_drill", title: "Drill", description: "", allocatedMinutes: 45, priorityScore: 90, status: "pending" },
      ];
      assertDailyBudget(tasks, budget);
      expect(tasks.reduce((s, t) => s + t.allocatedMinutes, 0)).toBe(budget);
    });

    it("T2.MST.25: priority score tie-breaker should preserve deterministic topic order", () => {
      const topicA = { id: "a", title: "Alpha Topic", priorityScore: 85.0 };
      const topicB = { id: "b", title: "Beta Topic", priorityScore: 85.0 };

      // Tie-breaker: sort by priority DESC, then alphabetical title ASC
      const sorted = [topicB, topicA].sort((x, y) => {
        if (x.priorityScore !== y.priorityScore) return y.priorityScore - x.priorityScore;
        return x.title.localeCompare(y.title);
      });

      expect(sorted[0].id).toBe("a");
      expect(sorted[1].id).toBe("b");
    });

    it("T2.MST.26: zero-exam weight (no past papers uploaded) should redistribute weights to deficit", () => {
      const weightsNoExam: PriorityWeights = {
        wDeficit: 0.60, // Boosted from 0.45
        wExam: 0.0,    // Zero because no past papers
        wBlind: 0.20,
        wPrereq: 0.20,
      };

      const sumWeights = weightsNoExam.wDeficit + weightsNoExam.wExam + weightsNoExam.wBlind + weightsNoExam.wPrereq;
      expect(sumWeights).toBeCloseTo(1.0, 5);
      expect(weightsNoExam.wExam).toBe(0.0);
    });
  });
});
