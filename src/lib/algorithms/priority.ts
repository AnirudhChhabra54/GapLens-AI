// ==============================================================================
// GapLens AI — Topic Priority Scoring Engine
// Computes multi-factor topic revision priority with deficit (0.45), exam weight (0.25),
// blind-spot risk (0.15), and prerequisite impact (0.15).
// Supports dynamic weight renormalization when exam papers or prerequisites are absent.
// ==============================================================================

import type { PriorityWeights, TopicPriorityFactors } from "@/types/planner";

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  wDeficit: 0.45,
  wExam: 0.25,
  wBlind: 0.15,
  wPrereq: 0.15,
};

export interface RawTopicFactorsInput {
  topicId: string;
  topicTitle: string;
  masteryScore: number; // 0.0 to 100.0
  examWeight?: number | null; // share of past paper marks (0.0 to 1.0)
  blindSpotCount?: number;
  totalAttempts?: number;
  downstreamDependentsCount?: number;
  totalTopicsCount?: number;
}

/**
 * Renormalizes priority weights when certain data sources (e.g. past papers or prerequisites) are absent.
 * Ensures the sum of active weights is always exactly 1.0.
 */
export function renormalizePriorityWeights(options: {
  hasPastPapers: boolean;
  hasPrerequisites: boolean;
  customWeights?: Partial<PriorityWeights>;
}): PriorityWeights {
  const base = { ...DEFAULT_PRIORITY_WEIGHTS, ...options.customWeights };

  let activeDeficit = base.wDeficit;
  let activeExam = options.hasPastPapers ? base.wExam : 0.0;
  let activeBlind = base.wBlind;
  let activePrereq = options.hasPrerequisites ? base.wPrereq : 0.0;

  const totalActive = activeDeficit + activeExam + activeBlind + activePrereq;

  if (totalActive <= 0) {
    return { wDeficit: 1.0, wExam: 0.0, wBlind: 0.0, wPrereq: 0.0 };
  }

  return {
    wDeficit: Number((activeDeficit / totalActive).toFixed(4)),
    wExam: Number((activeExam / totalActive).toFixed(4)),
    wBlind: Number((activeBlind / totalActive).toFixed(4)),
    wPrereq: Number((activePrereq / totalActive).toFixed(4)),
  };
}

/**
 * Computes individual topic priority factors and final score (0.0 to 100.0).
 */
export function computeTopicPriority(
  input: RawTopicFactorsInput,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
): TopicPriorityFactors {
  const {
    topicId,
    topicTitle,
    masteryScore,
    examWeight = 0,
    blindSpotCount = 0,
    totalAttempts = 0,
    downstreamDependentsCount = 0,
    totalTopicsCount = 1,
  } = input;

  // Mastery deficit: 1.0 - (mastery / 100), bounded in [0, 1]
  const masteryDeficit = Math.max(0, Math.min(1, 1.0 - masteryScore / 100));

  // Exam weight: bounded in [0, 1]
  const normExamWeight = Math.max(0, Math.min(1, examWeight ?? 0));

  // Blind spot risk: blindSpots / max(attempts, 1), bounded in [0, 1]
  const effectiveAttempts = Math.max(totalAttempts, 1);
  const blindSpotRisk = Math.max(0, Math.min(1, blindSpotCount / effectiveAttempts));

  // Prerequisite impact: downstream blocked ratio in [0, 1]
  const maxPossibleDependents = Math.max(1, totalTopicsCount - 1);
  const prerequisiteImpact = Math.max(0, Math.min(1, downstreamDependentsCount / maxPossibleDependents));

  const weightedSum =
    masteryDeficit * weights.wDeficit +
    normExamWeight * weights.wExam +
    blindSpotRisk * weights.wBlind +
    prerequisiteImpact * weights.wPrereq;

  const priorityScore = Number(Math.max(0, Math.min(100, weightedSum * 100)).toFixed(2));

  return {
    topicId,
    topicTitle,
    masteryDeficit: Number(masteryDeficit.toFixed(4)),
    examWeight: Number(normExamWeight.toFixed(4)),
    blindSpotRisk: Number(blindSpotRisk.toFixed(4)),
    prerequisiteImpact: Number(prerequisiteImpact.toFixed(4)),
    priorityScore,
  };
}

/**
 * Prioritizes a batch of topics with automatic weight renormalization and deterministic tie-breaking.
 * Sorting invariant: Higher priorityScore DESC; if equal, alphabetical topicTitle ASC.
 */
export function rankTopicsByPriority(
  topics: RawTopicFactorsInput[],
  options?: {
    hasPastPapers?: boolean;
    hasPrerequisites?: boolean;
    customWeights?: Partial<PriorityWeights>;
  }
): TopicPriorityFactors[] {
  // Check if any topic has non-zero exam weight
  const hasPastPapers =
    options?.hasPastPapers ?? topics.some((t) => (t.examWeight ?? 0) > 0);

  // Check if any topic has downstream dependents
  const hasPrerequisites =
    options?.hasPrerequisites ?? topics.some((t) => (t.downstreamDependentsCount ?? 0) > 0);

  const weights = renormalizePriorityWeights({
    hasPastPapers,
    hasPrerequisites,
    customWeights: options?.customWeights,
  });

  const scored = topics.map((t) =>
    computeTopicPriority(
      {
        ...t,
        totalTopicsCount: topics.length,
      },
      weights
    )
  );

  // Deterministic sorting: priorityScore DESC, then topicTitle ASC
  return scored.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.topicTitle.localeCompare(b.topicTitle);
  });
}
