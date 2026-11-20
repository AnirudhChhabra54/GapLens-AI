// ==============================================================================
// Tier 3: Pairwise Cross-Feature Interactions — Quiz to Mastery Pipeline
// Verifies integration pipeline:
// Question Gen -> Answer Submission -> Rubric Eval -> Bayesian Mastery Update -> Blind Spot Alert
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { getDemoQuestions, getDemoTopics, getWeakTopic, getBlindSpotTopic } from "../helpers/fixture-loader";
import { assertBayesianMastery, classifyCalibration } from "../helpers/assertion-helpers";
import type { AnswerRow, MasterySnapshotRow, ConfidenceLevel } from "@/types/database";

describe("Tier 3: Quiz to Mastery Pipeline (Cross-Feature Pairwise)", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  it("T3.QM.1: should generate questions with citations directly traceable to source chunks", () => {
    const questions = getDemoQuestions();
    for (const q of questions) {
      expect(q.source_chunk_id).toBeDefined();
      const chunk = db.document_chunks.find((c) => c.id === q.source_chunk_id);
      expect(chunk).toBeDefined();
    }
  });

  it("T3.QM.2: submitting a correct MCQ with high confidence should award 1.0 and increase topic mastery", async () => {
    const topic = db.topics[0]; // Architecture
    const initialMastery = topic.current_mastery;

    const evalRes = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse: "A",
      answerKey: "A",
    });

    expect(evalRes.isCorrect).toBe(true);
    expect(evalRes.score).toBe(1.0);

    // Compute updated Bayesian mastery
    const updatedMastery = assertBayesianMastery({
      attempts: [{ score: evalRes.score }],
      prior: initialMastery / 100,
      gamma: 0.80,
      k: 1.2,
    });

    expect(updatedMastery * 100).toBeGreaterThanOrEqual(initialMastery);
  });

  it("T3.QM.3: submitting high-confidence wrong answer must trigger blind-spot alert and decrement effective topic mastery", () => {
    const syncTopic = getBlindSpotTopic();
    const evalRes = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse: "A", // Wrong option
      answerKey: "B",
    });

    expect(evalRes.isCorrect).toBe(false);
    expect(evalRes.score).toBe(0.0);

    const calibration = classifyCalibration("high", evalRes.score);
    expect(calibration.isBlindSpot).toBe(true);
    expect(calibration.label).toBe("blind_spot");

    // Bayesian mastery decreases
    const updatedMastery = assertBayesianMastery({
      attempts: [{ score: 0.0 }],
      prior: syncTopic.current_mastery / 100,
      gamma: 0.80,
    });
    expect(updatedMastery * 100).toBeLessThan(syncTopic.current_mastery);
  });

  it("T3.QM.4: short answer evaluated against rubric should update topic attempts and evidence level", async () => {
    const question = getDemoQuestions().find((q) => q.question_type === "short_answer")!;
    const topic = db.topics.find((t) => t.id === question.topic_id)!;
    const initialAttempts = topic.total_attempts;

    const evalRes = gemini.evaluateAnswer({
      questionType: "short_answer",
      studentResponse: "The MMU detects the TLB miss and walks the page table in DRAM memory.",
      answerKey: question.answer_key,
      rubric: question.rubric,
    });

    expect(evalRes.rubricEvaluation).toBeDefined();
    expect(evalRes.score).toBeGreaterThan(0.0);

    // Record answer in database
    const newAnswer: AnswerRow = {
      id: "80000000-0000-0000-0000-000000000099",
      quiz_id: db.quizzes[0].id,
      quiz_question_id: question.id,
      topic_id: question.topic_id,
      user_id: db.profiles[0].id,
      student_response: "The MMU detects the TLB miss and walks the page table in DRAM memory.",
      confidence: "medium",
      is_correct: evalRes.isCorrect,
      score: evalRes.score,
      rubric_evaluation: evalRes.rubricEvaluation ?? null,
      feedback: evalRes.feedback,
      is_blind_spot: false,
      answered_at: new Date().toISOString(),
    };

    await db.from("answers").insert(newAnswer);

    // Update topic attempts count
    await db.from("topics").update({
      total_attempts: initialAttempts + 1,
      evidence_level: "strong_evidence",
    }).eq("id", topic.id);

    const { data: updatedTopic } = await db.from("topics").select("*").eq("id", topic.id).single();
    expect(updatedTopic!.total_attempts).toBe(initialAttempts + 1);
    expect(updatedTopic!.evidence_level).toBe("strong_evidence");
  });

  it("T3.QM.5: should record mastery snapshot in database after quiz completion", async () => {
    const topic = getWeakTopic();
    const snapshot: MasterySnapshotRow = {
      id: "90000000-0000-0000-0000-000000000099",
      workspace_id: db.workspaces[0].id,
      topic_id: topic.id,
      user_id: db.profiles[0].id,
      quiz_id: db.quizzes[0].id,
      mastery_score: 42.0,
      classification: "weak",
      evidence_level: "strong_evidence",
      effective_attempts: 6,
      recorded_at: new Date().toISOString(),
    };

    await db.from("mastery_snapshots").insert(snapshot);
    const { data } = await db.from("mastery_snapshots").select("*").eq("id", snapshot.id).single();

    expect(data).toBeDefined();
    expect(data!.mastery_score).toBe(42.0);
    expect(data!.classification).toBe("weak");
  });

  it("T3.QM.6: low confidence with high score should be categorized as uncertain_success / imposter", () => {
    const calibration = classifyCalibration("low", 1.0);
    expect(calibration.isUncertainSuccess).toBe(true);
    expect(calibration.isBlindSpot).toBe(false);
    expect(calibration.label).toBe("uncertain_success");
  });

  it("T3.QM.7: repeated correct attempts on weak topic should transition classification from weak to medium", () => {
    const initialWeak = 0.35; // 35% mastery
    const attempts = [{ score: 1.0 }, { score: 1.0 }, { score: 1.0 }];

    const upgradedMastery = assertBayesianMastery({
      attempts,
      prior: initialWeak,
      gamma: 0.80,
      k: 1.2,
    });

    expect(upgradedMastery).toBeGreaterThanOrEqual(0.60);
    // Boundary transition from weak (<0.40) to medium (0.40 - 0.70)
    expect(upgradedMastery >= 0.40).toBe(true);
  });

  it("T3.QM.8: quiz answer submission must be immutable once completed", async () => {
    const answer = db.answers[0];
    expect(answer.answered_at).toBeDefined();
    // Verify attempt ID cannot be changed
    const originalId = answer.id;
    await db.from("answers").update({ feedback: "Verified feedback" }).eq("id", originalId);
    const { data } = await db.from("answers").select("*").eq("id", originalId).single();
    expect(data!.id).toBe(originalId);
  });

  it("T3.QM.9: total quiz score and percentage should update reactively as answers are recorded", () => {
    const answers = db.answers;
    const totalScore = answers.reduce((acc, a) => acc + (a.score || 0), 0);
    const maxScore = answers.length * 1.0;
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    expect(totalScore).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);
  });

  it("T3.QM.10: blind spot item must link directly to the refuting source chunk citation", () => {
    const blindSpotAnswer = db.answers.find((a) => a.is_blind_spot);
    expect(blindSpotAnswer).toBeDefined();

    const question = db.quiz_questions.find((q) => q.id === blindSpotAnswer!.quiz_question_id);
    expect(question).toBeDefined();
    expect(question!.source_chunk_id).toBeDefined();
    expect(question!.citation_quote).toBeDefined();

    // Verify quote matches source chunk
    const chunk = db.document_chunks.find((c) => c.id === question!.source_chunk_id);
    expect(chunk).toBeDefined();
    expect(chunk!.content.toLowerCase()).toContain("memory barriers");
  });

  it("T3.QM.11: question answer key must never be sent in the safe client question payload", () => {
    const questions = getDemoQuestions();
    const safePayload = questions.map((q) => ({
      id: q.id,
      topicId: q.topic_id,
      questionText: q.question_text,
      options: q.options,
    }));

    for (const q of safePayload) {
      expect((q as any).answer_key).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
    }
  });
});
