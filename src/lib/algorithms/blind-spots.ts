// ==============================================================================
// GapLens AI — Confidence Calibration & Blind-Spot Detection Engine
// Identifies high-confidence misconceptions (blind spots) and underconfident successes (imposters).
// Generates actionable remedy instructions grounded in authentic citations.
// ==============================================================================

import type { ConfidenceLevel } from "@/types/database";
import type { PinnedCitation } from "@/types/rag";
import type {
  BlindSpotItem,
  BlindSpotSummary,
  ConfidenceCalibrationMetrics,
} from "@/types/assessment";

export const DEFAULT_BLIND_SPOT_SCORE_THRESHOLD = 0.50;
export const DEFAULT_IMPOSTER_SCORE_THRESHOLD = 0.80;
export const DEFAULT_CALIBRATION_MIN_SAMPLE = 3;
export const CONFIDENT_ANSWER_CORRECT_THRESHOLD = 0.70;

export interface CalibrationResult {
  isBlindSpot: boolean;
  isUncertainSuccess: boolean;
  label: "blind_spot" | "uncertain_success" | "aligned";
  description: string;
}

export interface CalibrationOptions {
  blindSpotThreshold?: number; // Score strictly below this is considered incorrect for high-confidence
  imposterThreshold?: number; // Score at or above this is considered strong success for low-confidence
}

/**
 * Classifies the calibration relationship between student confidence and answer score:
 * - High confidence + score < 0.50 => High-Confidence Blind Spot
 * - Low confidence + score >= 0.80 => Imposter / Uncertain Success
 * - Medium or aligned => Aligned
 */
export function classifyConfidenceAlignment(
  confidence: ConfidenceLevel,
  score: number,
  options?: CalibrationOptions
): CalibrationResult {
  const blindSpotThreshold = options?.blindSpotThreshold ?? DEFAULT_BLIND_SPOT_SCORE_THRESHOLD;
  const imposterThreshold = options?.imposterThreshold ?? DEFAULT_IMPOSTER_SCORE_THRESHOLD;

  const isBlindSpot = confidence === "high" && score < blindSpotThreshold;
  const isUncertainSuccess = confidence === "low" && score >= imposterThreshold;

  if (isBlindSpot) {
    return {
      isBlindSpot: true,
      isUncertainSuccess: false,
      label: "blind_spot",
      description: "High confidence with incorrect answer indicates a potential conceptual blind spot or misconception.",
    };
  }

  if (isUncertainSuccess) {
    return {
      isBlindSpot: false,
      isUncertainSuccess: true,
      label: "uncertain_success",
      description: "Low confidence with high score indicates underconfidence or imposter syndrome.",
    };
  }

  return {
    isBlindSpot: false,
    isUncertainSuccess: false,
    label: "aligned",
    description: "Confidence aligns with performance.",
  };
}

export interface EvaluatedAnswerInput {
  topicId: string;
  topicTitle: string;
  questionId: string;
  questionText: string;
  studentResponse: string;
  correctAnswer: string;
  confidence: ConfidenceLevel;
  score: number;
  citation: PinnedCitation;
  explanation?: string;
}

/**
 * Synthesizes a targeted, citation-grounded remedy action for a student's blind spot.
 */
export function generateRemedyAction(item: {
  topicTitle: string;
  citation: PinnedCitation;
  questionText: string;
  explanation?: string;
}): string {
  const docName = item.citation.documentName || "Course Syllabus";
  const section = item.citation.sectionHeading ? `Section "${item.citation.sectionHeading}"` : `Pages ${item.citation.pageStart}-${item.citation.pageEnd}`;
  const topic = item.topicTitle;

  return `Revisit ${section} in ${docName} for "${topic}". Focus on key distinctions: ${item.explanation || "review the fundamental definition and requirements."}`;
}

/**
 * Computes the independent confidence/correctness calibration signals required by
 * the gap report (high-confidence error rate, low-confidence correct rate, topic
 * sample counts). These metrics never feed back into the mastery score.
 */
export function computeConfidenceMetrics(
  answers: EvaluatedAnswerInput[],
  minimumSample = DEFAULT_CALIBRATION_MIN_SAMPLE
): ConfidenceCalibrationMetrics {
  let highConfidenceAttempts = 0;
  let highConfidenceIncorrect = 0;
  let lowConfidenceAttempts = 0;
  let lowConfidenceCorrect = 0;

  const perTopic = new Map<
    string,
    { topicTitle: string; totalAnswers: number; highConfidenceCount: number; lowConfidenceCount: number }
  >();

  for (const ans of answers) {
    const isCorrect = ans.score >= CONFIDENT_ANSWER_CORRECT_THRESHOLD;
    const stats = perTopic.get(ans.topicId) || {
      topicTitle: ans.topicTitle,
      totalAnswers: 0,
      highConfidenceCount: 0,
      lowConfidenceCount: 0,
    };

    stats.totalAnswers += 1;
    if (ans.confidence === "high") {
      highConfidenceAttempts += 1;
      stats.highConfidenceCount += 1;
      if (!isCorrect) highConfidenceIncorrect += 1;
    }
    if (ans.confidence === "low") {
      lowConfidenceAttempts += 1;
      stats.lowConfidenceCount += 1;
      if (isCorrect) lowConfidenceCorrect += 1;
    }

    perTopic.set(ans.topicId, stats);
  }

  const ratio = (numerator: number, denominator: number) =>
    denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;

  return {
    totalAnswers: answers.length,
    highConfidenceAttempts,
    highConfidenceIncorrect,
    highConfidenceErrorRate: ratio(highConfidenceIncorrect, highConfidenceAttempts),
    lowConfidenceAttempts,
    lowConfidenceCorrect,
    lowConfidenceCorrectRate: ratio(lowConfidenceCorrect, lowConfidenceAttempts),
    sampleSufficient: answers.length >= minimumSample,
    topicSampleCounts: Array.from(perTopic.entries()).map(([topicId, stats]) => ({
      topicId,
      ...stats,
    })),
  };
}

/**
 * Aggregates all blind spot items, identifies high-risk topics, and summarizes calibration metrics.
 */
export function aggregateBlindSpots(
  answers: EvaluatedAnswerInput[],
  options?: CalibrationOptions
): BlindSpotSummary {
  const items: BlindSpotItem[] = [];
  const topicCounts = new Map<string, { topicTitle: string; count: number }>();

  for (const ans of answers) {
    const calibration = classifyConfidenceAlignment(ans.confidence, ans.score, options);

    if (calibration.isBlindSpot) {
      const remedy = generateRemedyAction({
        topicTitle: ans.topicTitle,
        citation: ans.citation,
        questionText: ans.questionText,
        explanation: ans.explanation,
      });

      items.push({
        topicId: ans.topicId,
        topicTitle: ans.topicTitle,
        questionId: ans.questionId,
        questionText: ans.questionText,
        studentResponse: ans.studentResponse,
        correctAnswer: ans.correctAnswer,
        confidence: ans.confidence,
        evidenceQuote: ans.citation.quote || null,
        citation: ans.citation,
        remedyAction: remedy,
      });

      const existing = topicCounts.get(ans.topicId) || { topicTitle: ans.topicTitle, count: 0 };
      existing.count += 1;
      topicCounts.set(ans.topicId, existing);
    }
  }

  const highRiskTopics = Array.from(topicCounts.entries())
    .map(([topicId, info]) => ({
      topicId,
      topicTitle: info.topicTitle,
      blindSpotCount: info.count,
    }))
    .sort((a, b) => b.blindSpotCount - a.blindSpotCount);

  return {
    totalBlindSpots: items.length,
    highRiskTopics,
    items,
    calibration: computeConfidenceMetrics(answers),
  };
}
