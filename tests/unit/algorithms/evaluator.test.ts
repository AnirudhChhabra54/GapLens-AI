// ==============================================================================
// Unit Test: Answer Evaluation Engine
// Verifies deterministic MCQ grading, rubric-grounded short-answer evaluation,
// decoupled confidence capture, blind spot / imposter classification, and Bayesian mastery deltas.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  evaluateMCQ,
  evaluateShortAnswer,
  evaluateShortAnswerHeuristic,
  evaluateSubmission,
} from "@/lib/algorithms/evaluator";
import type { PinnedCitation } from "@/types/rag";
import type { QuizQuestionRow } from "@/types/database";

describe("Unit: Answer Evaluation Engine (evaluator.ts)", () => {
  const mockCitation: PinnedCitation = {
    chunkId: "c-100",
    documentId: "d-100",
    documentName: "Silberschatz OS Concepts",
    docType: "material",
    pageStart: 50,
    pageEnd: 52,
    sectionHeading: "Virtual Memory Paging",
    quote: "A page fault occurs when an access to a page marked invalid is executed.",
    isQuoteVerified: true,
  };

  describe("Deterministic MCQ Scoring", () => {
    it("should score matching option as 1.0 (case-insensitive)", () => {
      const resUpper = evaluateMCQ({
        questionId: "q-1",
        topicId: "t-1",
        studentResponse: "B",
        answerKey: "B",
        explanation: "Option B is correct because paging avoids external fragmentation.",
        confidence: "medium",
        citation: mockCitation,
      });

      const resLower = evaluateMCQ({
        questionId: "q-1",
        topicId: "t-1",
        studentResponse: "b",
        answerKey: "B",
        explanation: "Option B is correct because paging avoids external fragmentation.",
        confidence: "medium",
        citation: mockCitation,
      });

      expect(resUpper.isCorrect).toBe(true);
      expect(resUpper.score).toBe(1.0);
      expect(resLower.isCorrect).toBe(true);
      expect(resLower.score).toBe(1.0);
    });

    it("should score mismatched option as 0.0 with explanatory feedback", () => {
      const res = evaluateMCQ({
        questionId: "q-1",
        topicId: "t-1",
        studentResponse: "C",
        answerKey: "A",
        explanation: "Option A is correct.",
        confidence: "medium",
        citation: mockCitation,
      });

      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0.0);
      expect(res.feedback).toContain("Option A is correct");
    });

    it("should flag High Confidence Blind Spot when confidence is high but answer is incorrect", () => {
      const res = evaluateMCQ({
        questionId: "q-1",
        topicId: "t-1",
        studentResponse: "D",
        answerKey: "A",
        explanation: "Option A is the correct answer.",
        confidence: "high",
        citation: mockCitation,
      });

      expect(res.score).toBe(0.0);
      expect(res.isBlindSpot).toBe(true);
      expect(res.isUncertainSuccess).toBe(false);
    });

    it("should flag Imposter / Uncertain Success when confidence is low but answer is correct", () => {
      const res = evaluateMCQ({
        questionId: "q-1",
        topicId: "t-1",
        studentResponse: "A",
        answerKey: "A",
        explanation: "Option A is the correct answer.",
        confidence: "low",
        citation: mockCitation,
      });

      expect(res.score).toBe(1.0);
      expect(res.isBlindSpot).toBe(false);
      expect(res.isUncertainSuccess).toBe(true);
    });
  });

  describe("Rubric-Grounded Short-Answer Evaluation", () => {
    const rubric = [
      {
        keypoint: "Page fault definition",
        weight: 0.50,
        description: "Must state that page is not currently mapped into physical memory.",
      },
      {
        keypoint: "MMU trap mechanism",
        weight: 0.50,
        description: "Must explain that MMU traps to OS kernel to fetch page from backing store.",
      },
    ];

    it("should award partial credit across discrete rubric keypoints", () => {
      const response =
        "A page fault occurs when a referenced page is not present in physical RAM memory. The OS handles it.";

      const res = evaluateShortAnswerHeuristic({
        studentResponse: response,
        answerKey: "Page fault occurs when page is missing from physical memory, causing an MMU trap to OS.",
        rubric,
        explanation: "Keypoints cover page presence and trap mechanism.",
      });

      expect(res.rubricEvaluation.length).toBe(2);
      expect(res.score).toBeGreaterThan(0.0);
      expect(res.score).toBeLessThanOrEqual(1.0);
    });

    it("should award 0 score for empty answer without throwing exceptions", async () => {
      const res = await evaluateShortAnswer({
        questionId: "q-sa-1",
        topicId: "t-1",
        studentResponse: "",
        answerKey: "Full answer",
        rubric,
        explanation: "Explanation",
        confidence: "high",
        citation: mockCitation,
      });

      expect(res.score).toBe(0.0);
      expect(res.isCorrect).toBe(false);
      expect(res.isBlindSpot).toBe(true); // high confidence + empty answer
    });
  });

  describe("Complete Quiz Submission Evaluation", () => {
    it("should evaluate full submission, compute total score percentage, and mastery deltas", async () => {
      const mockQuestions: QuizQuestionRow[] = [
        {
          id: "q-sub-1",
          quiz_id: "quiz-1",
          topic_id: "top-vm",
          question_type: "mcq",
          difficulty: 2,
          question_text: "What is a page fault?",
          options: [
            { id: "A", text: "Invalid page reference" },
            { id: "B", text: "RAM failure" },
          ],
          answer_key: "A",
          explanation: "Invalid bit triggers page fault",
          rubric: null,
          source_chunk_id: "chunk-1",
          citation_document_name: "OS Lecture",
          citation_page_start: 1,
          citation_page_end: 1,
          citation_section: "Paging",
          citation_quote: "Invalid bit triggers page fault",
          is_quote_verified: true,
          created_at: new Date().toISOString(),
        },
      ];

      const response = await evaluateSubmission({
        quizId: "quiz-1",
        workspaceId: "ws-1",
        submissions: [
          {
            questionId: "q-sub-1",
            response: "A",
            confidence: "high",
          },
        ],
        questions: mockQuestions,
      });

      expect(response.quizId).toBe("quiz-1");
      expect(response.totalScore).toBe(1.0);
      expect(response.percentage).toBe(100.0);
      expect(response.answers.length).toBe(1);
      expect(response.masteryDeltas["top-vm"]).toBeDefined();
      expect(response.masteryDeltas["top-vm"].current).toBeGreaterThan(45.0);
    });
  });
});
