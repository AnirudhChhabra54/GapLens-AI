// ==============================================================================
// Unit Test: Grounded Question Generator Engine
// Verifies MCQ option count (4 options), rubric weight constraints (sum to 1.0),
// near-duplicate prevention, citation pinning, and answer stripping for SafeQuizQuestion.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  generateDiagnosticQuestions,
  generateQuestionDeterministic,
  isNearDuplicate,
  toSafeQuizQuestion,
} from "@/lib/algorithms/question-generator";
import { DEMO_CHUNKS } from "@/lib/demo/os-cs301-fixture";

describe("Unit: Grounded Question Generator (question-generator.ts)", () => {
  const sampleChunk = DEMO_CHUNKS[0]; // Virtual memory / OS concepts chunk

  describe("Near-Duplicate Prevention", () => {
    it("should detect near-duplicate questions", () => {
      const existing = [
        { question_text: "What is the primary role of the Translation Lookaside Buffer TLB?" },
      ];

      const candidate = "What is the primary role of the Translation Lookaside Buffer TLB in memory?";
      expect(isNearDuplicate(candidate, existing)).toBe(true);
    });

    it("should allow distinct questions on different concepts", () => {
      const existing = [
        { question_text: "What is the primary role of the Translation Lookaside Buffer TLB?" },
      ];

      const distinctCandidate = "Explain how mutex locks prevent race conditions in multithreaded systems.";
      expect(isNearDuplicate(distinctCandidate, existing)).toBe(false);
    });
  });

  describe("Deterministic Grounded Question Synthesis", () => {
    it("should generate MCQ with exactly 4 options and valid answer key", () => {
      const q = generateQuestionDeterministic({
        topicId: "top-vm",
        topicTitle: "Virtual Memory",
        chunk: sampleChunk,
        questionType: "mcq",
        difficulty: 2,
      });

      expect(q.questionType).toBe("mcq");
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBe(4);

      const optionIds = q.options!.map((o) => o.id);
      expect(optionIds).toContain(q.answerKey);

      expect(q.sourceChunkId).toBe(sampleChunk.id);
      expect(q.isQuoteVerified).toBe(true);
    });

    it("should generate short answer question with rubric weights summing exactly to 1.0", () => {
      const q = generateQuestionDeterministic({
        topicId: "top-vm",
        topicTitle: "Virtual Memory",
        chunk: sampleChunk,
        questionType: "short_answer",
        difficulty: 2,
      });

      expect(q.questionType).toBe("short_answer");
      expect(q.options).toBeNull();
      expect(q.rubric).toBeDefined();
      expect(q.rubric!.length).toBeGreaterThanOrEqual(2);

      const sumWeights = q.rubric!.reduce((sum, r) => sum + r.weight, 0);
      expect(sumWeights).toBeCloseTo(1.0, 4);

      for (const item of q.rubric!) {
        expect(item.keypoint.length).toBeGreaterThan(0);
        expect(item.weight).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("SafeQuizQuestion Serialization", () => {
    it("should strip answer_key, explanation, and rubric from client-facing question", () => {
      const question = generateQuestionDeterministic({
        topicId: "top-vm",
        topicTitle: "Virtual Memory",
        chunk: sampleChunk,
        questionType: "mcq",
        difficulty: 2,
      });

      const safe = toSafeQuizQuestion(question, "Virtual Memory");

      expect((safe as any).answerKey).toBeUndefined();
      expect((safe as any).answer_key).toBeUndefined();
      expect((safe as any).explanation).toBeUndefined();
      expect((safe as any).rubric).toBeUndefined();

      expect(safe.id).toBeDefined();
      expect(safe.topicId).toBe("top-vm");
      expect(safe.topicTitle).toBe("Virtual Memory");
      expect(safe.questionType).toBe("mcq");
      expect(safe.options!.length).toBe(4);
      expect(safe.citation.chunkId).toBe(sampleChunk.id);
    });
  });

  describe("End-to-End Generation Batch", () => {
    it("should generate requested count of grounded questions", async () => {
      const questions = await generateDiagnosticQuestions({
        topicId: "top-vm",
        topicTitle: "Virtual Memory",
        chunks: [sampleChunk],
        questionType: "mcq",
        difficulty: 2,
        targetCount: 2,
      });

      expect(questions.length).toBe(2);
      for (const q of questions) {
        expect(q.topicId).toBe("top-vm");
        expect(q.citationDocumentName).toBeDefined();
      }
    });
  });
});
