// ==============================================================================
// GapLens AI — Exam ROI (Expected Marks Gained per Hour Studied) Optimizer
// Ranks topics by expected exam mark return per study hour to maximize score
// under tight exam-eve time constraints.
// ==============================================================================

import type { TopicRow } from "@/types/database";

export interface ExamRoiEntry {
  topicId: string;
  topicTitle: string;
  unitModule: string | null;
  currentMastery: number;
  examWeight: number;
  estimatedMinutes: number;
  expectedMarksGainPerHour: number;
}

/**
 * Computes expected exam marks gained per hour of focused study (assuming 100-mark exam).
 */
export function computeExamRoiRankings(topics: TopicRow[]): ExamRoiEntry[] {
  if (topics.length === 0) return [];

  const fallbackWeight = 1 / topics.length;

  return topics
    .map((t) => {
      const mastery = Math.max(0, Math.min(100, t.current_mastery ?? 45));
      const weight = t.exam_weight && t.exam_weight > 0 ? t.exam_weight : fallbackWeight;
      const deficit = Math.max(0.05, (100 - mastery) / 100);
      // Estimated remediation duration scales with deficit and blind spots (15m to 60m)
      const estimatedMinutes = Math.min(
        60,
        Math.max(15, Math.round(15 + deficit * 30 + (t.blind_spot_count || 0) * 5))
      );
      const hours = estimatedMinutes / 60;
      const expectedMarksGain = weight * 100 * deficit;
      const expectedMarksGainPerHour = Number((expectedMarksGain / hours).toFixed(1));

      return {
        topicId: t.id,
        topicTitle: t.title,
        unitModule: t.unit_module,
        currentMastery: mastery,
        examWeight: weight,
        estimatedMinutes,
        expectedMarksGainPerHour,
      };
    })
    .sort((a, b) => b.expectedMarksGainPerHour - a.expectedMarksGainPerHour);
}
