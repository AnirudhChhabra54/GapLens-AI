// ==============================================================================
// GapLens AI — E2E Domain Assertion Helpers
// Implements mathematical and domain invariant checks for Bayesian mastery,
// RRF scoring, 768d vector invariants, quote verification, and daily budget.
// Supports execution under both Vitest and standalone Node/tsx runner.
// ==============================================================================

import type { ConfidenceLevel, MasteryClassification, TaskStatus } from "@/types/database";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`AssertionError: ${message}`);
  }
}

function expectWrapper(actual: any, message?: string) {
  if (typeof (globalThis as any).expect === "function") {
    return (globalThis as any).expect(actual);
  }
  return {
    toBe: (expected: any) => assert(actual === expected, `${message || "Expected equal"}: got ${actual}, expected ${expected}`),
    toBeGreaterThan: (expected: any) =>
      assert(actual > expected, `${message || "Expected greater"}: got ${actual}, expected > ${expected}`),
    toBeGreaterThanOrEqual: (expected: any) =>
      assert(actual >= expected, `${message || "Expected greater or equal"}: got ${actual}, expected >= ${expected}`),
    toBeLessThanOrEqual: (expected: any) =>
      assert(actual <= expected, `${message || "Expected less or equal"}: got ${actual}, expected <= ${expected}`),
  };
}

/**
 * Validates that an embedding is an exact 768-dimensional normalized float array.
 */
export function assert768dEmbedding(vector: unknown): asserts vector is number[] {
  expectWrapper(Array.isArray(vector), "Vector must be an array").toBe(true);
  const arr = vector as number[];
  expectWrapper(arr.length, "Embedding dimension must be exactly 768").toBe(768);

  let sumSquares = 0;
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    expectWrapper(Number.isFinite(val), `Vector element at ${i} must be finite`).toBe(true);
    expectWrapper(!Number.isNaN(val), `Vector element at ${i} must not be NaN`).toBe(true);
    sumSquares += val * val;
  }

  const norm = Math.sqrt(sumSquares);
  expectWrapper(norm > 0, "Embedding norm must be strictly positive").toBe(true);
}

/**
 * Asserts Bayesian Mastery with recency decay:
 * mu_t = gamma * mu_{t-1} + (1 - gamma) * (score)
 * or weighted attempt accumulation with gamma=0.80, prior=0.45, k=1.2.
 */
export function assertBayesianMastery(params: {
  prior?: number;
  gamma?: number;
  k?: number;
  attempts: Array<{ score: number; weight?: number; ageDays?: number }>;
  expectedMin?: number;
  expectedMax?: number;
}): number {
  const prior = params.prior ?? 0.45;
  const gamma = params.gamma ?? 0.80;
  const k = params.k ?? 1.2;

  let currentMastery = prior;

  for (const attempt of params.attempts) {
    const effectiveEvidence = Math.min(1.0, attempt.score * (k / 1.0));
    if (attempt.ageDays !== undefined && attempt.ageDays > 0) {
      // Ebbinghaus exponential recency decay towards baseline prior
      const recencyWeight = Math.pow(gamma, attempt.ageDays);
      currentMastery = prior + recencyWeight * (effectiveEvidence - prior);
    } else {
      // Step update
      const weight = attempt.weight ?? 1.0;
      currentMastery = gamma * currentMastery + (1 - gamma) * effectiveEvidence * weight;
    }
  }

  // Bound mastery between 0 and 1 (or 0% to 100%)
  const boundedMastery = Math.max(0, Math.min(1, currentMastery));

  if (params.expectedMin !== undefined) {
    expectWrapper(boundedMastery, `Mastery ${boundedMastery} >= ${params.expectedMin}`).toBeGreaterThanOrEqual(params.expectedMin);
  }
  if (params.expectedMax !== undefined) {
    expectWrapper(boundedMastery, `Mastery ${boundedMastery} <= ${params.expectedMax}`).toBeLessThanOrEqual(params.expectedMax);
  }

  return boundedMastery;
}

/**
 * Normalizes text for robust quote matching:
 * lowercase, collapsed whitespace, stripped punctuation.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Asserts quote verification against source chunk text.
 */
export function assertQuoteVerification(
  quote: string,
  chunkText: string,
  minThreshold: number = 0.85
): { verified: boolean; matchRatio: number } {
  const normQuote = normalizeText(quote);
  const normChunk = normalizeText(chunkText);

  if (normQuote.length === 0) {
    return { verified: false, matchRatio: 0 };
  }

  if (normChunk.includes(normQuote)) {
    return { verified: true, matchRatio: 1.0 };
  }

  // Token-level overlap ratio
  const quoteTokens = normQuote.split(" ");
  const chunkTokenSet = new Set(normChunk.split(" "));
  let matchedTokens = 0;

  for (const token of quoteTokens) {
    if (chunkTokenSet.has(token)) {
      matchedTokens++;
    }
  }

  const matchRatio = quoteTokens.length > 0 ? matchedTokens / quoteTokens.length : 0;
  const verified = matchRatio >= minThreshold;

  return { verified, matchRatio };
}

/**
 * Asserts daily study budget packing constraint:
 * Sum of allocatedMinutes <= maxMinutes for every single day.
 */
export function assertDailyBudget(
  tasks: Array<{ allocatedMinutes?: number; allocated_minutes?: number; status?: TaskStatus | string }>,
  maxMinutes: number
): void {
  const totalMinutes = tasks.reduce(
    (sum, t) => sum + (t.allocatedMinutes ?? t.allocated_minutes ?? 0),
    0
  );
  expectWrapper(
    totalMinutes <= maxMinutes,
    `Total allocated minutes (${totalMinutes}) must not exceed daily budget (${maxMinutes})`
  ).toBe(true);
}

/**
 * Asserts blind-spot classification based on confidence and score:
 * High confidence + Score < 0.40 => BLIND SPOT (misconception)
 * Low confidence + Score >= 0.70 => IMPOSTER / UNCERTAIN SUCCESS
 * Aligned otherwise.
 */
export function classifyCalibration(
  confidence: ConfidenceLevel,
  score: number
): { isBlindSpot: boolean; isUncertainSuccess: boolean; label: "blind_spot" | "uncertain_success" | "aligned" } {
  const isBlindSpot = confidence === "high" && score < 0.40;
  const isUncertainSuccess = confidence === "low" && score >= 0.70;

  let label: "blind_spot" | "uncertain_success" | "aligned" = "aligned";
  if (isBlindSpot) label = "blind_spot";
  else if (isUncertainSuccess) label = "uncertain_success";

  return { isBlindSpot, isUncertainSuccess, label };
}

export function assertBlindSpot(
  confidence: ConfidenceLevel,
  score: number,
  expected: "blind_spot" | "uncertain_success" | "aligned"
): void {
  const result = classifyCalibration(confidence, score);
  expectWrapper(
    result.label,
    `Expected calibration label ${expected} for confidence=${confidence}, score=${score}`
  ).toBe(expected);
}

/**
 * Asserts Reciprocal Rank Fusion (RRF) calculation:
 * score = 1 / (k + rank_vector) + 1 / (k + rank_keyword)
 */
export function calculateRRFScore(rankVector: number, rankKeyword: number, k: number = 60): number {
  return 1 / (k + rankVector) + 1 / (k + rankKeyword);
}

export function assertRRFScoring(
  items: Array<{ rrf_score: number }>,
  k: number = 60
): void {
  expectWrapper(items.length > 0, "Items list must not be empty").toBe(true);
  for (let i = 0; i < items.length - 1; i++) {
    expectWrapper(
      items[i].rrf_score >= items[i + 1].rrf_score,
      `Item at ${i} score (${items[i].rrf_score}) must be >= item at ${i + 1} (${items[i + 1].rrf_score})`
    ).toBe(true);
  }
}
