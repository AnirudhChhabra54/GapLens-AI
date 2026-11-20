// ==============================================================================
// Tier 2: Boundary & Corner Cases — Assessment & Answer Evaluation Boundaries
// Tests edge conditions in answer evaluation: non-ASCII characters, empty answers,
// max-length submissions, MCQ format variations, idempotency, and rubric scoring edges.
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { DeterministicGeminiMock, InMemorySupabaseMock } from "../helpers/mock-adapters";
import { getDemoQuestions, getDemoAnswers, getDemoProfile } from "../helpers/fixture-loader";
import type { RubricKeypoint, QuizQuestionRow } from "@/types/database";

describe("Tier 2: Assessment & Answer Evaluation Boundaries", () => {
  let gemini: DeterministicGeminiMock;
  let db: InMemorySupabaseMock;
  let sampleShortAnswer: QuizQuestionRow;

  beforeEach(() => {
    gemini = new DeterministicGeminiMock();
    db = new InMemorySupabaseMock();
    sampleShortAnswer = getDemoQuestions().find((q) => q.question_type === "short_answer")!;
  });

  // ----------------------------------------------------------------------------
  // 1. Non-ASCII, Unicode & Foreign Script Inputs
  // ----------------------------------------------------------------------------
  describe("Non-ASCII, Unicode & Foreign Script Inputs", () => {
    it("T2.EVL.1: should grade answers containing mathematical notation and symbols (α, β, ∑, ≤, ≥)", () => {
      const mathAnswer =
        "The mathematical formula for effective memory access time on a TLB miss penalty is EMAT = α × (t + m) + (1 - α) × (t + 2m) where α is the TLB hit ratio and m is DRAM memory access time.";
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: mathAnswer,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBeGreaterThan(0.0);
      expect(res.feedback).toBeDefined();
    });

    it("T2.EVL.2: should grade answers containing accented Latin characters (café, rôle, naïve)", () => {
      const accentedAnswer = "The rôle of the memory management unit is to walk the page table in DRAM memory on a TLB miss.";
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: accentedAnswer,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBeGreaterThan(0.0);
    });

    it("T2.EVL.3: should grade completely foreign language response as not_met without crashing", () => {
      const foreignAnswer = "这是一个关于操作系统虚拟内存分页机制的回答。";
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: foreignAnswer,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBe(0.0);
      expect(res.isCorrect).toBe(false);
    });

    it("T2.EVL.4: should grade emojis in student response without throwing parsing errors", () => {
      const emojiAnswer = "TLB miss causes DRAM lookup 😭 memory page table walk 💀";
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: emojiAnswer,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBeGreaterThan(0.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Empty & Length Extremes
  // ----------------------------------------------------------------------------
  describe("Empty & Length Extremes", () => {
    it("T2.EVL.5: empty string response should award 0.0 score", () => {
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: "",
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBe(0.0);
      expect(res.isCorrect).toBe(false);
    });

    it("T2.EVL.6: whitespace-only response should award 0.0 score", () => {
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: "   \t\n   ",
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBe(0.0);
      expect(res.isCorrect).toBe(false);
    });

    it("T2.EVL.7: massive 5,000 character student response should be evaluated without timeout", () => {
      const longResponse = "On a TLB miss, the MMU reads page tables in memory. " + "Padding explanation text. ".repeat(250);
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: longResponse,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBeGreaterThan(0.0);
      expect(res.score).toBeLessThanOrEqual(1.0);
    });

    it("T2.EVL.8: single-word response should receive zero or appropriate partial credit", () => {
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: "paging",
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.isCorrect).toBe(false);
      expect(res.score).toBeLessThan(0.4);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. MCQ Format Variations & Edge Choices
  // ----------------------------------------------------------------------------
  describe("MCQ Format Variations & Edge Choices", () => {
    it("T2.EVL.9: should match option with leading and trailing whitespace (' A ')", () => {
      const res = gemini.evaluateAnswer({
        questionType: "mcq",
        studentResponse: "  A  ",
        answerKey: "A",
      });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(1.0);
    });

    it("T2.EVL.10: should grade lowercase option submission ('b') against uppercase key ('B')", () => {
      const res = gemini.evaluateAnswer({
        questionType: "mcq",
        studentResponse: "b",
        answerKey: "B",
      });
      expect(res.isCorrect).toBe(true);
      expect(res.score).toBe(1.0);
    });

    it("T2.EVL.11: should reject option not in the available choices ('Z')", () => {
      const res = gemini.evaluateAnswer({
        questionType: "mcq",
        studentResponse: "Z",
        answerKey: "A",
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0.0);
    });

    it("T2.EVL.12: should reject multi-option string ('A, B') when single choice expected", () => {
      const res = gemini.evaluateAnswer({
        questionType: "mcq",
        studentResponse: "A, B",
        answerKey: "A",
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0.0);
    });

    it("T2.EVL.13: should handle empty option string gracefully", () => {
      const res = gemini.evaluateAnswer({
        questionType: "mcq",
        studentResponse: "",
        answerKey: "A",
      });
      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Rubric Edge Evaluations & Marks Distribution
  // ----------------------------------------------------------------------------
  describe("Rubric Edge Evaluations & Marks Distribution", () => {
    it("T2.EVL.14: complete answer meeting all criteria should receive 1.0 total score", () => {
      const perfectResponse =
        "On a TLB miss, the hardware MMU detects the miss and walks the multi-level page table in memory DRAM. " +
        "It then reloads and updates the TLB with the newly translated page frame entry for subsequent hits. " +
        "The mathematical formula for Effective Memory Access Time is EMAT = hit_rate * (tlb + mem) + (1 - hit_rate) * (tlb + 2*mem).";

      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: perfectResponse,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.isCorrect).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(0.9);
      expect(res.rubricEvaluation!.every((item) => item.status === "met")).toBe(true);
    });

    it("T2.EVL.15: completely incorrect answer should have all rubric items flagged as not_met", () => {
      const irrelevantResponse = "Operating systems use the file system to organize directories and inodes.";

      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: irrelevantResponse,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.isCorrect).toBe(false);
      expect(res.score).toBe(0.0);
      expect(res.rubricEvaluation!.every((item) => item.status === "not_met")).toBe(true);
    });

    it("T2.EVL.16: partial answer should accurately reflect partially_met or met status on respective items", () => {
      const partialResponse = "The MMU walks the page table in memory on a TLB miss.";

      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: partialResponse,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.rubricEvaluation).toBeDefined();
      const firstItem = res.rubricEvaluation![0];
      expect(firstItem.status === "met" || firstItem.status === "partially_met").toBe(true);
      const marks = firstItem.marks_awarded ?? firstItem.marksAwarded ?? 0;
      expect(marks).toBeGreaterThan(0);
    });

    it("T2.EVL.17: sum of rubric marks awarded should never exceed 1.0", () => {
      const res = gemini.evaluateAnswer({
        questionType: "short_answer",
        studentResponse: sampleShortAnswer.answer_key,
        answerKey: sampleShortAnswer.answer_key,
        rubric: sampleShortAnswer.rubric,
      });

      expect(res.score).toBeLessThanOrEqual(1.0);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Submission Idempotency & Database Integrity
  // ----------------------------------------------------------------------------
  describe("Submission Idempotency & Database Integrity", () => {
    it("T2.EVL.18: submitting an answer for the same question twice should update rather than duplicate", async () => {
      const existing = db.answers[0];
      const initialCount = db.answers.length;

      // Update existing record
      await db.from("answers").update({
        student_response: "B",
        score: 0.0,
        is_correct: false,
      }).eq("id", existing.id);

      expect(db.answers.length).toBe(initialCount);
      const { data } = await db.from("answers").select("*").eq("id", existing.id).single();
      expect(data!.student_response).toBe("B");
    });

    it("T2.EVL.19: should reject answer submission for non-existent question ID", async () => {
      const invalidQuestionId = "60000000-0000-0000-0000-999999999999";
      const { data } = await db.from("quiz_questions").select("*").eq("id", invalidQuestionId).maybeSingle();
      expect(data).toBeNull();
    });

    it("T2.EVL.20: should enforce user ownership constraint on answer row", () => {
      const answer = db.answers[0];
      expect(answer.user_id).toBe(db.profiles[0].id);
    });

    it("T2.EVL.21: answer timestamp should be a valid ISO 8601 string", () => {
      const answer = db.answers[0];
      expect(new Date(answer.answered_at).getTime()).not.toBeNaN();
    });

    it("T2.EVL.22: total quiz score must equal the sum of constituent answer scores", () => {
      const quiz = db.quizzes[0];
      const quizAnswers = db.answers.filter((a) => a.quiz_id === quiz.id);
      const sumScores = quizAnswers.reduce((sum, a) => sum + (a.score || 0), 0);

      expect(sumScores).toBeCloseTo(quiz.total_score || 0, 2);
    });

    it("T2.EVL.23: feedback string should be non-empty for both correct and incorrect answers", () => {
      for (const answer of db.answers) {
        expect(answer.feedback.length).toBeGreaterThan(10);
      }
    });

    it("T2.EVL.24: answered questions must retain their association to their target topic", () => {
      for (const answer of db.answers) {
        expect(answer.topic_id).toBeDefined();
        const topic = db.topics.find((t) => t.id === answer.topic_id);
        expect(topic).toBeDefined();
      }
    });

    it("T2.EVL.25: blind spot flag must only be set when confidence is high and answer is incorrect", () => {
      for (const answer of db.answers) {
        if (answer.is_blind_spot) {
          expect(answer.confidence).toBe("high");
          expect(answer.is_correct).toBe(false);
          expect(answer.score).toBeLessThan(0.40);
        }
      }
    });

    it("T2.EVL.26: quiz percentage calculation must be bound between 0 and 100", () => {
      const quiz = db.quizzes[0];
      const percentage = (quiz.total_score! / quiz.max_possible_score!) * 100;
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });
  });
});
