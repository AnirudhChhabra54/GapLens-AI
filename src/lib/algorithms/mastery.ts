// ==============================================================================
// GapLens AI — Bayesian Mastery Engine
// Deterministic Bayesian mastery calculation with exponential recency decay,
// difficulty multipliers, conservative priors, and evidence strength classification.
// ==============================================================================

import type { MasteryClassification, EvidenceStrength } from "@/types/database";

export const DEFAULT_GAMMA_RECENCY_DECAY = 0.80;
export const DEFAULT_PRIOR_MU0 = 0.45;
export const DEFAULT_PRIOR_WEIGHT_K = 1.2;

export interface MasteryAttempt {
  score: number; // 0.0 to 1.0
  difficulty?: number; // 1: Foundation (0.9), 2: Standard (1.0), 3: Advanced (1.1)
  ageDays?: number; // Optional age in days for forgetting curve
  weight?: number; // Optional explicit weight override
}

export interface MasteryCalculationOptions {
  prior?: number; // Default 0.45
  gamma?: number; // Default 0.80
  k?: number; // Default 1.2
}

export interface HistoricalAttemptRecord {
  score: number;
  difficulty?: number;
  answeredAt?: string | null;
}

export interface MasteryResult {
  masteryScore: number; // 0.0 to 100.0
  normalizedMastery: number; // 0.0 to 1.0
  classification: MasteryClassification;
  evidenceLevel: EvidenceStrength;
  totalAttempts: number;
  effectiveWeight: number; // W = sum(w_i)
  weightedSum: number; // Y = sum(w_i * y_i)
  prior: number; // mu0
  priorWeight: number; // k
  attemptDetails: Array<{
    score: number;
    weight: number;
    difficultyMultiplier: number;
  }>;
}

/**
 * Resolves difficulty multiplier d_i in {0.9, 1.0, 1.1}.
 * 1 (Foundation) -> 0.9
 * 2 (Standard)   -> 1.0
 * 3 (Advanced)   -> 1.1
 */
export function getDifficultyMultiplier(difficulty?: number): number {
  if (difficulty === 1) return 0.9;
  if (difficulty === 3) return 1.1;
  return 1.0;
}

/**
 * Classifies a mastery score (0-100) into MasteryClassification:
 * < 55: weak
 * 55 to < 80: medium
 * >= 80: strong
 * 0 attempts: unassessed
 */
export function classifyMastery(
  score: number,
  totalAttempts: number
): MasteryClassification {
  if (totalAttempts === 0) return "unassessed";
  if (score < 55) return "weak";
  if (score < 80) return "medium";
  return "strong";
}

/**
 * Classifies evidence strength based on attempt count:
 * < 2 attempts: early_signal
 * 2 - 4 attempts: developing_evidence
 * >= 5 attempts: strong_evidence
 */
export function classifyEvidenceStrength(totalAttempts: number): EvidenceStrength {
  if (totalAttempts < 2) return "early_signal";
  if (totalAttempts <= 4) return "developing_evidence";
  return "strong_evidence";
}

/**
 * Computes deterministic Bayesian mastery with recency decay:
 * For attempts i = 1..n:
 *   score y_i in [0, 1]
 *   recency decay gamma = 0.80
 *   difficulty multiplier d_i in {0.9, 1.0, 1.1}
 *   w_i = (ageDays !== undefined ? gamma^ageDays : gamma^(n - i)) * d_i
 *   W = sum(w_i)
 *   Y = sum(w_i * y_i)
 *   mastery_base = 100 * (Y + k * mu0) / (W + k)
 */
export function calculateMastery(
  attempts: MasteryAttempt[],
  options?: MasteryCalculationOptions
): MasteryResult {
  const mu0 = options?.prior ?? DEFAULT_PRIOR_MU0;
  const gamma = options?.gamma ?? DEFAULT_GAMMA_RECENCY_DECAY;
  const k = options?.k ?? DEFAULT_PRIOR_WEIGHT_K;

  const n = attempts.length;

  if (n === 0) {
    const priorPercent = Number((mu0 * 100).toFixed(2));
    return {
      masteryScore: priorPercent,
      normalizedMastery: mu0,
      classification: "unassessed",
      evidenceLevel: "early_signal",
      totalAttempts: 0,
      effectiveWeight: 0,
      weightedSum: 0,
      prior: mu0,
      priorWeight: k,
      attemptDetails: [],
    };
  }

  let W = 0;
  let Y = 0;
  const attemptDetails: MasteryResult["attemptDetails"] = [];

  for (let i = 0; i < n; i++) {
    const attempt = attempts[i];
    // Clamp score y_i in [0, 1]
    const yi = Math.max(0, Math.min(1, attempt.score));
    const di = getDifficultyMultiplier(attempt.difficulty);

    let wi: number;
    if (attempt.weight !== undefined) {
      wi = attempt.weight;
    } else if (attempt.ageDays !== undefined && attempt.ageDays >= 0) {
      wi = Math.pow(gamma, attempt.ageDays) * di;
    } else {
      // Recency power: (n - 1 - i) so the most recent attempt (i = n-1) has gamma^0 = 1.0
      wi = Math.pow(gamma, n - 1 - i) * di;
    }

    W += wi;
    Y += wi * yi;

    attemptDetails.push({
      score: yi,
      weight: Number(wi.toFixed(6)),
      difficultyMultiplier: di,
    });
  }

  const normalizedMastery = Math.max(0, Math.min(1, (Y + k * mu0) / (W + k)));
  const masteryScore = Number((normalizedMastery * 100).toFixed(2));

  return {
    masteryScore,
    normalizedMastery: Number(normalizedMastery.toFixed(4)),
    classification: classifyMastery(masteryScore, n),
    evidenceLevel: classifyEvidenceStrength(n),
    totalAttempts: n,
    effectiveWeight: Number(W.toFixed(4)),
    weightedSum: Number(Y.toFixed(4)),
    prior: mu0,
    priorWeight: k,
    attemptDetails,
  };
}

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Reconstructs topic mastery from persisted answer records, so the cached
 * `topics.current_mastery` value is never the only source of truth.
 *
 * When answer timestamps are available each attempt receives a real forgetting
 * curve weight (gamma^ageDays). Otherwise the attempts are treated as an ordered
 * history and the most recent attempt receives weight 1.0.
 */
export function reconstructMasteryFromAttempts(
  records: HistoricalAttemptRecord[],
  now: Date = new Date(),
  options?: MasteryCalculationOptions
): MasteryResult {
  if (records.length === 0) {
    return calculateMastery([], options);
  }

  const hasTimestamps = records.every(
    (r) => r.answeredAt != null && !Number.isNaN(new Date(r.answeredAt).getTime())
  );

  const attempts: MasteryAttempt[] = records
    .slice()
    .sort((a, b) => {
      if (!hasTimestamps) return 0;
      return new Date(a.answeredAt!).getTime() - new Date(b.answeredAt!).getTime();
    })
    .map((record) => {
      if (!hasTimestamps) {
        return { score: record.score, difficulty: record.difficulty };
      }
      const ageDays = Math.max(
        0,
        (now.getTime() - new Date(record.answeredAt!).getTime()) / MILLISECONDS_PER_DAY
      );
      return {
        score: record.score,
        difficulty: record.difficulty,
        ageDays: Number(ageDays.toFixed(4)),
      };
    });

  return calculateMastery(attempts, options);
}
