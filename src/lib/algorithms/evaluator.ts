// ==============================================================================
// GapLens AI — Answer Evaluation Engine
// Deterministic MCQ scoring and rubric-grounded short-answer evaluation.
// Decoupled confidence capture for blind-spot and imposter detection.
// Updates Bayesian mastery per topic and provides formative citation feedback.
// ==============================================================================

import type {
  ConfidenceLevel,
  QuizQuestionRow,
  RubricKeypoint,
  RubricEvaluationItem,
  MCQOption,
} from "@/types/database";
import type {
  StudentAnswerSubmission,
  EvaluatedAnswer,
  QuizEvaluationResponse,
} from "@/types/assessment";
import type { PinnedCitation } from "@/types/rag";
import { generateStructured } from "@/lib/ai/gemini";
import { ShortAnswerEvaluationSchema } from "@/lib/ai/schemas";
import { classifyConfidenceAlignment } from "./blind-spots";
import { calculateMastery } from "./mastery";

export interface EvaluatedAnswerResult {
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

/**
 * Deterministic MCQ evaluation:
 * Compares student option against answer key case-insensitively.
 */
export function evaluateMCQ(params: {
  questionId: string;
  topicId: string;
  studentResponse: string;
  answerKey: string;
  explanation: string;
  confidence: ConfidenceLevel;
  citation: PinnedCitation;
  options?: MCQOption[] | null;
}): EvaluatedAnswerResult {
  const {
    questionId,
    topicId,
    studentResponse,
    answerKey,
    explanation,
    confidence,
    citation,
    options,
  } = params;

  const resp = studentResponse.trim().toUpperCase();
  const key = answerKey.trim().toUpperCase();

  // Check direct option letter match or option text match
  let isCorrect = resp === key;

  if (!isCorrect && options && options.length > 0) {
    const matchedOption = options.find((o) => o.text.trim().toLowerCase() === studentResponse.trim().toLowerCase());
    if (matchedOption && matchedOption.id.toUpperCase() === key) {
      isCorrect = true;
    }
  }

  const score = isCorrect ? 1.0 : 0.0;
  const calibration = classifyConfidenceAlignment(confidence, score);

  let feedback: string;
  if (isCorrect) {
    feedback = `Correct! ${explanation}`;
  } else {
    const correctOpt = options?.find((o) => o.id.toUpperCase() === key);
    const optText = correctOpt ? `: "${correctOpt.text}"` : "";
    feedback = `Incorrect. The correct answer was option ${key}${optText}. ${explanation}`;
  }

  return {
    questionId,
    topicId,
    isCorrect,
    score,
    confidence,
    feedback,
    isBlindSpot: calibration.isBlindSpot,
    isUncertainSuccess: calibration.isUncertainSuccess,
    citation,
    correctAnswer: answerKey,
    explanation,
  };
}

/**
 * Heuristic rubric evaluation for short answers when running offline or in tests.
 */
export function evaluateShortAnswerHeuristic(params: {
  studentResponse: string;
  answerKey: string;
  rubric: RubricKeypoint[];
  explanation: string;
}): {
  score: number;
  rubricEvaluation: RubricEvaluationItem[];
  feedback: string;
} {
  const { studentResponse, rubric, explanation } = params;

  if (!studentResponse || studentResponse.trim().length === 0) {
    return {
      score: 0.0,
      rubricEvaluation: rubric.map((r) => ({
        keypoint: r.keypoint,
        status: "not_met",
        rationale: "No answer provided.",
        marks_awarded: 0,
      })),
      feedback: "No answer was provided. Review the concept in the course material.",
    };
  }

  const respLower = studentResponse.toLowerCase();
  const evaluation: RubricEvaluationItem[] = [];
  let totalScore = 0;

  for (const r of rubric) {
    const keypointTerms = r.keypoint.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const descTerms = r.description.toLowerCase().split(/\s+/).filter((w) => w.length > 4);

    let matchCount = 0;
    for (const term of keypointTerms) {
      if (respLower.includes(term)) matchCount++;
    }
    for (const term of descTerms) {
      if (respLower.includes(term)) matchCount += 0.5;
    }

    let status: "met" | "partially_met" | "not_met" = "not_met";
    let marks = 0;

    if (matchCount >= 2.0) {
      status = "met";
      marks = r.weight;
    } else if (matchCount >= 0.8) {
      status = "partially_met";
      marks = r.weight * 0.5;
    }

    totalScore += marks;

    evaluation.push({
      keypoint: r.keypoint,
      status,
      rationale:
        status === "met"
          ? `Concept "${r.keypoint}" is thoroughly articulated.`
          : status === "partially_met"
          ? `Concept "${r.keypoint}" is partially mentioned but missing supporting details.`
          : `Concept "${r.keypoint}" was not identified in the response.`,
      marks_awarded: Number(marks.toFixed(3)),
    });
  }

  const normalizedScore = Math.min(1.0, Math.max(0.0, Number(totalScore.toFixed(3))));
  const feedback =
    normalizedScore >= 0.70
      ? `Strong answer. ${explanation}`
      : `Partial understanding demonstrated. ${explanation}`;

  return {
    score: normalizedScore,
    rubricEvaluation: evaluation,
    feedback,
  };
}

/**
 * Rubric-grounded short conceptual answer evaluation:
 * Uses Gemini structured output to classify each rubric keypoint as met, partially_met, or not_met.
 * Computes exact score from rubric weights in backend server code.
 */
export async function evaluateShortAnswer(params: {
  questionId: string;
  topicId: string;
  studentResponse: string;
  answerKey: string;
  rubric: RubricKeypoint[];
  explanation: string;
  confidence: ConfidenceLevel;
  citation: PinnedCitation;
  sourceChunkContent?: string;
}): Promise<EvaluatedAnswerResult> {
  const {
    questionId,
    topicId,
    studentResponse,
    answerKey,
    rubric,
    explanation,
    confidence,
    citation,
  } = params;

  if (!studentResponse || studentResponse.trim().length === 0) {
    const heuristic = evaluateShortAnswerHeuristic({
      studentResponse,
      answerKey,
      rubric,
      explanation,
    });
    const calibration = classifyConfidenceAlignment(confidence, 0.0);

    return {
      questionId,
      topicId,
      isCorrect: false,
      score: 0.0,
      confidence,
      feedback: heuristic.feedback,
      isBlindSpot: calibration.isBlindSpot,
      isUncertainSuccess: calibration.isUncertainSuccess,
      rubricEvaluation: heuristic.rubricEvaluation,
      citation,
      correctAnswer: answerKey,
      explanation,
    };
  }

  try {
    const { data } = await generateStructured({
      prompt: `Evaluate the following student's short conceptual answer against the given rubric keypoints.
Classify each keypoint as 'met', 'partially_met', or 'not_met' with a rationale.
Do not grade spelling or minor phrasing differences as errors unless exact terminology is required.

Model / Key Answer:
"""
${answerKey}
"""

Rubric Keypoints:
${JSON.stringify(rubric, null, 2)}

Student Response:
"""
${studentResponse}
"""`,
      schema: ShortAnswerEvaluationSchema,
      systemInstruction:
        "You are an objective academic evaluator. Classify each rubric keypoint rigorously based solely on whether the conceptual points are addressed. The backend computes the numeric score.",
      mockFallback: () => {
        const heuristic = evaluateShortAnswerHeuristic({
          studentResponse,
          answerKey,
          rubric,
          explanation,
        });
        return {
          score: heuristic.score,
          rubric_evaluation: heuristic.rubricEvaluation,
          feedback: heuristic.feedback,
          is_blind_spot: confidence === "high" && heuristic.score < 0.50,
        };
      },
    });

    // Recompute score deterministically from backend rubric weights to prevent hallucinated scores
    let computedScore = 0;
    const finalRubricEval: RubricEvaluationItem[] = [];

    for (let i = 0; i < rubric.length; i++) {
      const keypointDef = rubric[i];
      const modelItem = data.rubric_evaluation?.find((r) => r.keypoint === keypointDef.keypoint) ||
        data.rubric_evaluation?.[i];

      const status = modelItem?.status || "not_met";
      let marks = 0;
      if (status === "met") {
        marks = keypointDef.weight;
      } else if (status === "partially_met") {
        marks = keypointDef.weight * 0.5;
      }

      computedScore += marks;
      finalRubricEval.push({
        keypoint: keypointDef.keypoint,
        status,
        rationale: modelItem?.rationale || `Keypoint evaluated as ${status}`,
        marks_awarded: Number(marks.toFixed(3)),
      });
    }

    const finalScore = Math.min(1.0, Math.max(0.0, Number(computedScore.toFixed(3))));
    const calibration = classifyConfidenceAlignment(confidence, finalScore);
    const isCorrect = finalScore >= 0.70;

    return {
      questionId,
      topicId,
      isCorrect,
      score: finalScore,
      confidence,
      feedback: data.feedback || (isCorrect ? `Strong answer. ${explanation}` : `Partial answer. ${explanation}`),
      isBlindSpot: calibration.isBlindSpot,
      isUncertainSuccess: calibration.isUncertainSuccess,
      rubricEvaluation: finalRubricEval,
      citation,
      correctAnswer: answerKey,
      explanation,
    };
  } catch {
    const heuristic = evaluateShortAnswerHeuristic({
      studentResponse,
      answerKey,
      rubric,
      explanation,
    });
    const calibration = classifyConfidenceAlignment(confidence, heuristic.score);

    return {
      questionId,
      topicId,
      isCorrect: heuristic.score >= 0.70,
      score: heuristic.score,
      confidence,
      feedback: heuristic.feedback,
      isBlindSpot: calibration.isBlindSpot,
      isUncertainSuccess: calibration.isUncertainSuccess,
      rubricEvaluation: heuristic.rubricEvaluation,
      citation,
      correctAnswer: answerKey,
      explanation,
    };
  }
}

/**
 * Evaluates an entire student quiz submission across multiple questions.
 * Computes individual answer scores, identifies blind spots, updates Bayesian mastery deltas,
 * and compiles the complete evaluation summary.
 */
export async function evaluateSubmission(params: {
  quizId: string;
  workspaceId: string;
  submissions: StudentAnswerSubmission[];
  questions: QuizQuestionRow[];
  currentMasteryMap?: Map<string, number>; // topicId -> current mastery (0-100)
  historicalAttemptsMap?: Map<string, Array<{ score: number; difficulty?: number }>>;
}): Promise<QuizEvaluationResponse> {
  const {
    quizId,
    workspaceId,
    submissions,
    questions,
    currentMasteryMap = new Map(),
    historicalAttemptsMap = new Map(),
  } = params;

  const questionMap = new Map<string, QuizQuestionRow>();
  for (const q of questions) {
    questionMap.set(q.id, q);
  }

  const evaluatedAnswers: EvaluatedAnswer[] = [];
  let totalScoreSum = 0;
  const maxPossibleScore = submissions.length;
  let newBlindSpotsCount = 0;

  // Track attempts per topic to update mastery deltas
  const topicAttemptsDelta = new Map<string, Array<{ score: number; difficulty: number }>>();

  for (const sub of submissions) {
    const q = questionMap.get(sub.questionId);
    if (!q) continue;

    const citation: PinnedCitation = {
      chunkId: q.source_chunk_id,
      documentId: "",
      documentName: q.citation_document_name,
      docType: "material",
      pageStart: q.citation_page_start,
      pageEnd: q.citation_page_end,
      sectionHeading: q.citation_section || null,
      quote: q.citation_quote,
      isQuoteVerified: q.is_quote_verified,
    };

    let evaluated: EvaluatedAnswerResult;

    if (q.question_type === "mcq") {
      evaluated = evaluateMCQ({
        questionId: q.id,
        topicId: q.topic_id,
        studentResponse: sub.response,
        answerKey: q.answer_key,
        explanation: q.explanation,
        confidence: sub.confidence,
        citation,
        options: q.options,
      });
    } else {
      evaluated = await evaluateShortAnswer({
        questionId: q.id,
        topicId: q.topic_id,
        studentResponse: sub.response,
        answerKey: q.answer_key,
        rubric: q.rubric || [
          { keypoint: "Core concept", weight: 1.0, description: "Accurately addresses the question" },
        ],
        explanation: q.explanation,
        confidence: sub.confidence,
        citation,
      });
    }

    if (evaluated.isBlindSpot) {
      newBlindSpotsCount++;
    }

    totalScoreSum += evaluated.score;

    evaluatedAnswers.push({
      questionId: evaluated.questionId,
      topicId: evaluated.topicId,
      isCorrect: evaluated.isCorrect,
      score: evaluated.score,
      confidence: evaluated.confidence,
      feedback: evaluated.feedback,
      isBlindSpot: evaluated.isBlindSpot,
      isUncertainSuccess: evaluated.isUncertainSuccess,
      rubricEvaluation: evaluated.rubricEvaluation,
      citation: evaluated.citation,
      correctAnswer: evaluated.correctAnswer,
      explanation: evaluated.explanation,
    });

    const existingDelta = topicAttemptsDelta.get(q.topic_id) || [];
    existingDelta.push({ score: evaluated.score, difficulty: q.difficulty || 2 });
    topicAttemptsDelta.set(q.topic_id, existingDelta);
  }

  // Calculate mastery deltas
  const masteryDeltas: QuizEvaluationResponse["masteryDeltas"] = {};

  for (const [topicId, newAttempts] of topicAttemptsDelta.entries()) {
    const previousScore = currentMasteryMap.get(topicId) ?? 45.0;
    const history = historicalAttemptsMap.get(topicId) || [];
    const allAttempts = [...history, ...newAttempts];

    const masteryResult = calculateMastery(allAttempts);

    masteryDeltas[topicId] = {
      previous: previousScore,
      current: masteryResult.masteryScore,
      classification: masteryResult.classification,
      evidenceLevel: masteryResult.evidenceLevel,
      totalAttempts: allAttempts.length,
      correctAttempts: allAttempts.filter((a) => a.score >= 0.7).length,
    };
  }

  const percentage = maxPossibleScore > 0 ? Number(((totalScoreSum / maxPossibleScore) * 100).toFixed(1)) : 0;

  return {
    quizId,
    workspaceId,
    totalScore: Number(totalScoreSum.toFixed(2)),
    maxPossibleScore,
    percentage,
    answers: evaluatedAnswers,
    masteryDeltas,
    newBlindSpotsCount,
  };
}
