// ==============================================================================
// GapLens AI — Ebbinghaus Forgetting-Curve "Exam-Day Time Machine"
// Projects topic mastery decay over t days forward using memory stability
// scaled by verified diagnostic attempts, surfacing "Silent Cliff" topics.
// ==============================================================================

import type { TopicMastery } from "@/types/assessment";

export interface TopicDecayProjection {
  topicId: string;
  topicTitle: string;
  currentMastery: number;
  projectedMastery: number;
  decayDelta: number;
  isSilentCliff: boolean; // Currently >= 60% (looks safe today) but drops < 55% by target day
}

export interface TimeMachineSimulation {
  daysAhead: number;
  currentAverageMastery: number;
  projectedAverageMastery: number;
  silentCliffTopics: TopicDecayProjection[];
  projections: TopicDecayProjection[];
}

const RETENTION_FLOOR = 25;

/**
 * Projects mastery retention t days into the future using an Ebbinghaus curve:
 * R(t) = floor + (M0 - floor) * exp(-t / stabilityDays)
 * Stability grows with totalAttempts so well-practiced topics decay slower.
 */
export function projectTopicMasteryAtDay(
  currentMastery: number,
  totalAttempts: number,
  daysAhead: number
): number {
  if (daysAhead <= 0) return Number(currentMastery.toFixed(1));
  if (currentMastery <= RETENTION_FLOOR) return Number(currentMastery.toFixed(1));

  // Base stability: 7 days for untested prior, +4 days per verified attempt
  const stabilityDays = 7 + Math.max(0, totalAttempts) * 4;
  const retentionFactor = Math.exp(-daysAhead / stabilityDays);
  const projected = RETENTION_FLOOR + (currentMastery - RETENTION_FLOOR) * retentionFactor;
  return Number(Math.max(RETENTION_FLOOR, Math.min(100, projected)).toFixed(1));
}

/**
 * Simulates forgetting decay across all workspace topics at `daysAhead` days.
 */
export function simulateForgettingCurve(
  topics: TopicMastery[],
  daysAhead: number
): TimeMachineSimulation {
  if (topics.length === 0) {
    return {
      daysAhead,
      currentAverageMastery: 0,
      projectedAverageMastery: 0,
      silentCliffTopics: [],
      projections: [],
    };
  }

  const projections: TopicDecayProjection[] = topics.map((t) => {
    const current = t.masteryScore ?? 45;
    const projected = projectTopicMasteryAtDay(current, t.totalAttempts ?? 0, daysAhead);
    const decayDelta = Number((projected - current).toFixed(1));
    const isSilentCliff = current >= 60 && projected < 55;
    return {
      topicId: t.topicId,
      topicTitle: t.topicTitle,
      currentMastery: current,
      projectedMastery: projected,
      decayDelta,
      isSilentCliff,
    };
  });

  const currentAverageMastery = Number(
    (projections.reduce((s, p) => s + p.currentMastery, 0) / projections.length).toFixed(1)
  );
  const projectedAverageMastery = Number(
    (projections.reduce((s, p) => s + p.projectedMastery, 0) / projections.length).toFixed(1)
  );

  return {
    daysAhead,
    currentAverageMastery,
    projectedAverageMastery,
    silentCliffTopics: projections.filter((p) => p.isSilentCliff),
    projections,
  };
}
