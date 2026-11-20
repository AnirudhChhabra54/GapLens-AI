// ==============================================================================
// Tier 4: Real-World Application Scenarios — Blind-Spot Diagnosis & Remediation
// Tests High-Confidence Misconception flow:
// 1. Student indicates High Confidence on Concurrency & Synchronization
// 2. Student selects erroneous answer on Peterson's Algorithm memory reordering
// 3. System identifies High-Confidence Blind Spot (confidence=high, score=0.0)
// 4. Gap Report displays urgent misconception alert pinning exact textbook quote
// 5. Student reviews citation, consults Study Copilot, and resolves blind spot on retest
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { getBlindSpotTopic, getDemoQuestions, getDemoChunks } from "../helpers/fixture-loader";
import { classifyCalibration, assertQuoteVerification } from "../helpers/assertion-helpers";

describe("Tier 4: Scenario 4 — Confidence Blind-Spot Diagnosis & Remediation", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  it("should diagnose overconfident misconception on Process Synchronization, pin refuting textbook evidence, and remediate", async () => {
    const syncTopic = getBlindSpotTopic();
    const petersonQuestion = getDemoQuestions().find((q) => q.id === "60000000-0000-0000-0000-000000000005")!;
    expect(petersonQuestion).toBeDefined();

    // 1. Student takes diagnostic question with HIGH confidence
    const studentResponse = "A"; // Erroneous choice: "Modern CPUs support more than two concurrent processes"
    const studentConfidence = "high"; // Overconfident assertion

    // 2. Server evaluates response
    const evalRes = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse,
      answerKey: petersonQuestion.answer_key,
    });

    expect(evalRes.isCorrect).toBe(false);
    expect(evalRes.score).toBe(0.0);

    // 3. System diagnoses High-Confidence Blind Spot
    const calibration = classifyCalibration(studentConfidence, evalRes.score);
    expect(calibration.isBlindSpot).toBe(true);
    expect(calibration.label).toBe("blind_spot");

    // 4. Verify refuting citation is pinned directly from trusted chunk record
    const citedChunkId = petersonQuestion.source_chunk_id;
    const citedChunk = db.document_chunks.find((c) => c.id === citedChunkId)!;
    expect(citedChunk).toBeDefined();

    const expectedMisconceptionRefutation =
      "modern out-of-order processors can reorder independent memory loads and stores, breaking correctness without explicit memory barriers.";

    const verification = assertQuoteVerification(expectedMisconceptionRefutation, citedChunk.content);
    expect(verification.verified).toBe(true);
    expect(verification.matchRatio).toBeGreaterThanOrEqual(0.85);

    // 5. Gap Report reflects 1 active High-Confidence Blind Spot with pinned citation
    const blindSpotCard = {
      topicId: syncTopic.id,
      topicTitle: syncTopic.title,
      questionText: petersonQuestion.question_text,
      studentResponse: "Modern CPUs support more than two concurrent processes",
      correctExplanation: petersonQuestion.explanation,
      citation: {
        documentName: petersonQuestion.citation_document_name,
        pageStart: petersonQuestion.citation_page_start,
        pageEnd: petersonQuestion.citation_page_end,
        quote: expectedMisconceptionRefutation,
      },
      actionableRemedy: "Review Silberschatz Chapter 6 p. 11-12 on memory consistency models and mfence instructions.",
    };

    expect(blindSpotCard.citation.quote).toContain("out-of-order processors");
    expect(blindSpotCard.citation.pageStart).toBe(11);

    // 6. Student consults Copilot for targeted explanation of memory fences
    const copilotRes = await gemini.copilotChat({
      message: "Why does Peterson's algorithm fail on modern multicore processors?",
      chunks: db.document_chunks,
    });

    expect(copilotRes.isRefusal).toBe(false);
    expect(copilotRes.citations.length).toBeGreaterThan(0);
    expect(copilotRes.citations[0].chunkId).toBe(citedChunkId);

    // 7. Student retakes the question and chooses the correct option with high confidence
    const retestResponse = "B"; // Correct choice: "Out-of-order processors and memory subsystems may reorder stores and loads"
    const retestEval = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse: retestResponse,
      answerKey: petersonQuestion.answer_key,
    });

    expect(retestEval.isCorrect).toBe(true);
    expect(retestEval.score).toBe(1.0);

    // Retest is correctly aligned (High confidence + 1.0 score)
    const retestCalibration = classifyCalibration("high", retestEval.score);
    expect(retestCalibration.isBlindSpot).toBe(false);
    expect(retestCalibration.label).toBe("aligned");

    // 8. Topic blind spot count decrements to 0
    await db.from("topics").update({ blind_spot_count: 0 }).eq("id", syncTopic.id);
    const { data: updatedTopic } = await db.from("topics").select("*").eq("id", syncTopic.id).single();
    expect(updatedTopic!.blind_spot_count).toBe(0);
  });
});
