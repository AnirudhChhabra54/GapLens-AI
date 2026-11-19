// ==============================================================================
// GapLens AI — Assessment, Evaluation, and Mastery Domain Types
// ==============================================================================

import type {
  ConfidenceLevel,
  EvidenceStrength,
  MasteryClassification,
  QuestionType,
  MCQOption,
  RubricKeypoint,
  RubricEvaluationItem,
} from "./database";
import type { PinnedCitation } from "./rag";

export interface SafeQuizQuestion {
  id: string;
  topicId: string;
  topicTitle: string;
  questionType: QuestionType;
  difficulty: number;
  questionText: string;
  options: MCQOption[] | null;
  citation: Omit<PinnedCitation, "quote">;
}

export interface StudentAnswerSubmission {
  questionId: string;
  response: string; // Option id for MCQ, written text for Short Answer
  confidence: ConfidenceLevel;
}

export interface EvaluatedAnswer {
  questionId: string;
  topicId: string;
  isCorrect: boolean;
  score: number; // 0.0 to 1.0
  confidence: ConfidenceLevel;
  feedback: string;
  isBlindSpot: boolean;
  isUncertainSuccess: boolean;
  rubricEvaluation?: RubricEvaluationItem[];
  citation: PinnedCitation;
  correctAnswer: string;
  explanation: string;
}

export interface QuizEvaluationResponse {
  quizId: string;
  workspaceId: string;
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  answers: EvaluatedAnswer[];
  masteryDeltas: Record<
    string,
    {
      previous: number;
      current: number;
      classification: MasteryClassification;
      evidenceLevel: EvidenceStrength;
      totalAttempts: number;
      correctAttempts: number;
    }
  >;
  newBlindSpotsCount: number;
}

export interface TopicMastery {
  topicId: string;
  topicTitle: string;
  unitModule: string | null;
  masteryScore: number; // 0.0 to 100.0
  classification: MasteryClassification;
  evidenceLevel: EvidenceStrength;
  totalAttempts: number;
  correctAttempts: number;
  blindSpotCount: number;
  examWeight: number;
  examFrequency: number;
  lastAttemptAt: string | null;
}

export interface BlindSpotItem {
  topicId: string;
  topicTitle: string;
  questionId: string;
  questionText: string;
  studentResponse: string;
  correctAnswer: string;
  confidence: ConfidenceLevel; // 'high'
  evidenceQuote?: string | null;
  citation: PinnedCitation;
  remedyAction: string;
}

export interface ConfidenceCalibrationMetrics {
  totalAnswers: number;
  highConfidenceAttempts: number;
  highConfidenceIncorrect: number;
  highConfidenceErrorRate: number;
  lowConfidenceAttempts: number;
  lowConfidenceCorrect: number;
  lowConfidenceCorrectRate: number;
  sampleSufficient: boolean;
  topicSampleCounts: Array<{
    topicId: string;
    topicTitle: string;
    totalAnswers: number;
    highConfidenceCount: number;
    lowConfidenceCount: number;
  }>;
}

export interface BlindSpotSummary {
  totalBlindSpots: number;
  highRiskTopics: Array<{ topicId: string; topicTitle: string; blindSpotCount: number }>;
  items: BlindSpotItem[];
  calibration?: ConfidenceCalibrationMetrics;
}

export interface ReadinessMetrics {
  readinessScore: number; // 0 to 100
  assessedTopicsCount: number;
  totalTopicsCount: number;
  coveragePercentage: number;
  averageMastery: number;
  isDataSufficient: boolean;
  insufficiencyReason?: string;
}

export interface AssessmentTopicResult {
  topicId: string;
  masteryScore: number;
  classification: MasteryClassification;
  evidenceLevel?: EvidenceStrength;
  totalAttempts?: number;
  correctAttempts?: number;
  isBlindSpot?: boolean;
  blindSpot?: BlindSpotItem;
}

export interface GapReportData {
  workspaceId: string;
  workspaceTitle: string;
  examDate: string | null;
  daysRemaining: number | null;
  readiness: ReadinessMetrics;
  blindSpots: BlindSpotSummary;
  topics: TopicMastery[];
  topicBreakdown?: any[];
  urgentActions?: any[];
  generatedAt?: string;
}
