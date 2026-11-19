// ==============================================================================
// Unit Test: Bayesian Mastery Math Engine
// Verifies recency decay (gamma=0.80), conservative prior (mu0=0.45, k=1.2),
// difficulty multipliers (0.9, 1.0, 1.1), score clamping, forgetting curves,
// classification cutoffs, evidence levels, and explainability metadata.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  calculateMastery,
  reconstructMasteryFromAttempts,
  classifyMastery,
  classifyEvidenceStrength,
  getDifficultyMultiplier,
  DEFAULT_GAMMA_RECENCY_DECAY,
  DEFAULT_PRIOR_MU0,
  DEFAULT_PRIOR_WEIGHT_K,
} from "@/lib/algorithms/mastery";

describe("Unit: Bayesian Mastery Engine (mastery.ts)", () => {
  describe("Default Parameters and Multipliers", () => {
    it("should have correct default constants", () => {
      expect(DEFAULT_GAMMA_RECENCY_DECAY).toBe(0.80);
      expect(DEFAULT_PRIOR_MU0).toBe(0.45);
      expect(DEFAULT_PRIOR_WEIGHT_K).toBe(1.2);
    });

    it("should resolve difficulty multipliers correctly", () => {
      expect(getDifficultyMultiplier(1)).toBe(0.9); // Foundation
      expect(getDifficultyMultiplier(2)).toBe(1.0); // Standard
      expect(getDifficultyMultiplier(3)).toBe(1.1); // Advanced
      expect(getDifficultyMultiplier(undefined)).toBe(1.0); // Default
    });
  });

  describe("Zero Attempts (Unassessed Edge Case)", () => {
    it("should return unassessed classification and prior when attempts are empty", () => {
      const result = calculateMastery([]);
      expect(result.totalAttempts).toBe(0);
      expect(result.classification).toBe("unassessed");
      expect(result.evidenceLevel).toBe("early_signal");
      expect(result.masteryScore).toBe(45.0);
      expect(result.normalizedMastery).toBe(0.45);
      expect(result.effectiveWeight).toBe(0);
      expect(result.weightedSum).toBe(0);
      expect(result.attemptDetails).toEqual([]);
    });
  });

  describe("Single Attempt Updates", () => {
    it("should increase mastery from prior on a perfect score (1.0)", () => {
      const result = calculateMastery([{ score: 1.0, difficulty: 2 }]);
      // W = 1.0, Y = 1.0
      // normalizedMastery = (1.0 + 1.2 * 0.45) / (1.0 + 1.2) = 1.54 / 2.2 = 0.70
      expect(result.masteryScore).toBeCloseTo(70.0, 1);
      expect(result.normalizedMastery).toBeGreaterThan(0.45);
      expect(result.classification).toBe("medium"); // 55 to <80
      expect(result.evidenceLevel).toBe("early_signal");
    });

    it("should decrease mastery from prior on zero score (0.0)", () => {
      const result = calculateMastery([{ score: 0.0, difficulty: 2 }]);
      // W = 1.0, Y = 0.0
      // normalizedMastery = (0.0 + 1.2 * 0.45) / (1.0 + 1.2) = 0.54 / 2.2 = 0.2455
      expect(result.masteryScore).toBeCloseTo(24.55, 1);
      expect(result.normalizedMastery).toBeLessThan(0.45);
      expect(result.classification).toBe("weak"); // <55
      expect(result.evidenceLevel).toBe("early_signal");
    });
  });

  describe("Recency Decay & Difficulty Weighting", () => {
    it("should weight recent attempts exponentially higher than older attempts", () => {
      // Sequence: older failure (0.0), recent success (1.0)
      const failThenPass = calculateMastery([
        { score: 0.0, difficulty: 2 },
        { score: 1.0, difficulty: 2 },
      ]);

      // Sequence: older success (1.0), recent failure (0.0)
      const passThenFail = calculateMastery([
        { score: 1.0, difficulty: 2 },
        { score: 0.0, difficulty: 2 },
      ]);

      expect(failThenPass.masteryScore).toBeGreaterThan(passThenFail.masteryScore);
    });

    it("should weight advanced questions higher than foundation questions", () => {
      const advancedPass = calculateMastery([{ score: 1.0, difficulty: 3 }]);
      const foundationPass = calculateMastery([{ score: 1.0, difficulty: 1 }]);

      expect(advancedPass.effectiveWeight).toBeGreaterThan(foundationPass.effectiveWeight);
      expect(advancedPass.masteryScore).toBeGreaterThan(foundationPass.masteryScore);
    });
  });

  describe("Boundary Clamping and Asymptotic Convergence", () => {
    it("should clamp input scores exceeding 1.0 to 1.0", () => {
      const result = calculateMastery([{ score: 2.5 }]);
      expect(result.attemptDetails[0].score).toBe(1.0);
      expect(result.normalizedMastery).toBeLessThanOrEqual(1.0);
    });

    it("should clamp negative scores to 0.0", () => {
      const result = calculateMastery([{ score: -1.0 }]);
      expect(result.attemptDetails[0].score).toBe(0.0);
      expect(result.normalizedMastery).toBeGreaterThanOrEqual(0.0);
    });

    it("repeated 1.0 scores should asymptotically converge towards 100", () => {
      const attempts = Array.from({ length: 15 }, () => ({ score: 1.0, difficulty: 2 }));
      const result = calculateMastery(attempts);

      expect(result.masteryScore).toBeGreaterThan(88.0);
      expect(result.masteryScore).toBeLessThanOrEqual(100.0);
      expect(result.classification).toBe("strong");
      expect(result.evidenceLevel).toBe("strong_evidence");
    });

    it("repeated 0.0 scores should asymptotically converge towards 0", () => {
      const attempts = Array.from({ length: 15 }, () => ({ score: 0.0, difficulty: 2 }));
      const result = calculateMastery(attempts);

      expect(result.masteryScore).toBeLessThan(10.0);
      expect(result.masteryScore).toBeGreaterThanOrEqual(0.0);
      expect(result.classification).toBe("weak");
      expect(result.evidenceLevel).toBe("strong_evidence");
    });
  });

  describe("Forgetting Curve (ageDays Decay)", () => {
    it("should decay older knowledge back towards the conservative baseline prior (45.0)", () => {
      const freshAttempt = calculateMastery([{ score: 1.0, ageDays: 0 }]);
      const weekOldAttempt = calculateMastery([{ score: 1.0, ageDays: 7 }]);
      const monthOldAttempt = calculateMastery([{ score: 1.0, ageDays: 30 }]);

      expect(freshAttempt.masteryScore).toBeGreaterThan(weekOldAttempt.masteryScore);
      expect(weekOldAttempt.masteryScore).toBeGreaterThan(monthOldAttempt.masteryScore);
      expect(monthOldAttempt.masteryScore).toBeCloseTo(45.0, 0);
    });
  });

  describe("Classification and Evidence Level Mappings", () => {
    it("should correctly classify scores across all threshold boundaries", () => {
      expect(classifyMastery(0, 0)).toBe("unassessed");
      expect(classifyMastery(54.99, 1)).toBe("weak");
      expect(classifyMastery(55.0, 1)).toBe("medium");
      expect(classifyMastery(79.99, 3)).toBe("medium");
      expect(classifyMastery(80.0, 3)).toBe("strong");
      expect(classifyMastery(100.0, 5)).toBe("strong");
    });

    it("should classify evidence levels based on attempt counts", () => {
      expect(classifyEvidenceStrength(0)).toBe("early_signal");
      expect(classifyEvidenceStrength(1)).toBe("early_signal");
      expect(classifyEvidenceStrength(2)).toBe("developing_evidence");
      expect(classifyEvidenceStrength(4)).toBe("developing_evidence");
      expect(classifyEvidenceStrength(5)).toBe("strong_evidence");
      expect(classifyEvidenceStrength(10)).toBe("strong_evidence");
    });
  });

  describe("Explainability Metadata", () => {
    it("should provide full mathematical transparency in result object", () => {
      const result = calculateMastery([
        { score: 0.8, difficulty: 2 },
        { score: 0.9, difficulty: 3 },
      ]);

      expect(result.prior).toBe(0.45);
      expect(result.priorWeight).toBe(1.2);
      expect(result.effectiveWeight).toBeGreaterThan(0);
      expect(result.weightedSum).toBeGreaterThan(0);
      expect(result.attemptDetails.length).toBe(2);
      expect(result.attemptDetails[0].weight).toBeDefined();
      expect(result.attemptDetails[1].difficultyMultiplier).toBe(1.1);
    });
  });
  describe("Evidence Reconstruction from Raw Attempts", () => {
    it("should reconstruct mastery without relying on a cached score", () => {
      const attempted = reconstructMasteryFromAttempts([
        { score: 0.0, difficulty: 2, answeredAt: "2026-11-10T10:00:00.000Z" },
        { score: 1.0, difficulty: 2, answeredAt: "2026-11-18T10:00:00.000Z" },
      ], new Date("2026-11-19T10:00:00.000Z"));

      expect(attempted.totalAttempts).toBe(2);
      expect(attempted.masteryScore).toBeGreaterThan(45);
      expect(attempted.masteryScore).toBeLessThan(100);
      expect(attempted.classification).not.toBe("unassessed");
      expect(attempted.evidenceLevel).toBe("developing_evidence");
    });

    it("should keep unassessed topics at the conservative prior with no attempts", () => {
      const attempted = reconstructMasteryFromAttempts([]);
      expect(attempted.totalAttempts).toBe(0);
      expect(attempted.masteryScore).toBe(45);
      expect(attempted.classification).toBe("unassessed");
    });

    it("should weight the most recent attempt more heavily", () => {
      const improving = reconstructMasteryFromAttempts([
        { score: 0.0, difficulty: 2 },
        { score: 1.0, difficulty: 2 },
      ]);
      const declining = reconstructMasteryFromAttempts([
        { score: 1.0, difficulty: 2 },
        { score: 0.0, difficulty: 2 },
      ]);

      expect(improving.masteryScore).toBeGreaterThan(declining.masteryScore);
    });
  });
});
