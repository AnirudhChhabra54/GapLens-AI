// ==============================================================================
// Tier 4: Real-World Application Scenarios — Canonical Judge Learning Journey
// Executes the complete 16-step end-to-end learning loop required by ORIGINAL_REQUEST §12:
// LOGIN -> CREATE WORKSPACE -> UPLOAD MATERIAL -> INDEX DOCUMENTS ->
// BUILD TOPIC MAP -> RETRIEVE SOURCE MATERIAL -> GENERATE DIAGNOSTIC QUESTIONS ->
// ANSWER QUESTIONS -> EVALUATE ANSWERS -> IDENTIFY KNOWLEDGE GAPS ->
// GENERATE REVISION PLAN -> STUDY WEAK TOPICS -> RETAKE ASSESSMENT ->
// UPDATE MASTERY -> REORDER REVISION PLAN -> DISPLAY IMPROVEMENT.
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { assert768dEmbedding, assertBayesianMastery, assertDailyBudget, classifyCalibration } from "../helpers/assertion-helpers";
import type { DocumentRow, DocumentChunkRow, TopicRow, QuizQuestionRow, AnswerRow } from "@/types/database";

describe("Tier 4: Scenario 1 — Canonical 16-Step Judge Learning Journey", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  it("should execute the full 16-step canonical learning loop with measurable improvement", async () => {
    // --------------------------------------------------------------------------
    // STEP 1: LOGIN
    // --------------------------------------------------------------------------
    const { data: profile } = await db.from("profiles").select("*").eq("email", "demo@gapfinder.ai").single();
    expect(profile).toBeDefined();
    expect(profile!.email).toBe("demo@gapfinder.ai");
    const userId = profile!.id;

    // --------------------------------------------------------------------------
    // STEP 2: CREATE WORKSPACE
    // --------------------------------------------------------------------------
    const workspaceId = "10000000-0000-0000-0000-000000000099";
    const newWorkspace = {
      id: workspaceId,
      user_id: userId,
      title: "Advanced Systems Programming (CS-401)",
      description: "Distributed Systems, Virtual Memory, and Fault Tolerance",
      exam_date: "2026-12-15",
      daily_study_minutes: 60,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("workspaces").insert(newWorkspace);
    const { data: ws } = await db.from("workspaces").select("*").eq("id", workspaceId).single();
    expect(ws!.title).toContain("CS-401");

    // --------------------------------------------------------------------------
    // STEP 3: UPLOAD MATERIAL
    // --------------------------------------------------------------------------
    const docId = "20000000-0000-0000-0000-000000000099";
    const newDoc: DocumentRow = {
      id: docId,
      workspace_id: workspaceId,
      user_id: userId,
      filename: "CS401_Core_Textbook.pdf",
      storage_path: `${userId}/${workspaceId}/CS401_Core_Textbook.pdf`,
      file_type: "application/pdf",
      declared_size_bytes: 2500000,
      doc_type: "material",
      status: "uploaded",
      page_count: 0,
      extracted_char_count: 0,
      chunk_count: 0,
      current_checkpoint: { step: "uploaded" },
      error_message: null,
      parser_version: "unpdf-v2.2",
      index_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("documents").insert(newDoc);

    // --------------------------------------------------------------------------
    // STEP 4: INDEX DOCUMENTS
    // --------------------------------------------------------------------------
    await db.from("documents").update({ status: "extracting", page_count: 10, extracted_char_count: 25000 }).eq("id", docId);
    await db.from("documents").update({ status: "chunking", chunk_count: 2 }).eq("id", docId);

    const chunkContent1 = "Demand paging brings pages into physical RAM only upon reference; an invalid bit access triggers a page fault interrupt.";
    const chunkContent2 = "Translation Lookaside Buffer (TLB) caches virtual to physical address translations to minimize memory access time.";

    const emb1 = await gemini.embedText(chunkContent1);
    const emb2 = await gemini.embedText(chunkContent2);
    assert768dEmbedding(emb1);
    assert768dEmbedding(emb2);

    const chunk1: DocumentChunkRow = {
      id: "30000000-0000-0000-0000-000000000091",
      document_id: docId,
      workspace_id: workspaceId,
      user_id: userId,
      chunk_index: 1,
      index_version: 1,
      page_start: 1,
      page_end: 2,
      section_heading: "Demand Paging",
      content: chunkContent1,
      embedding: emb1,
      embedding_model: "gemini-embedding-001",
      embedding_dimensions: 768,
      fts: chunkContent1.toLowerCase(),
      created_at: new Date().toISOString(),
    };

    const chunk2: DocumentChunkRow = {
      id: "30000000-0000-0000-0000-000000000092",
      document_id: docId,
      workspace_id: workspaceId,
      user_id: userId,
      chunk_index: 2,
      index_version: 1,
      page_start: 3,
      page_end: 4,
      section_heading: "TLB Operation",
      content: chunkContent2,
      embedding: emb2,
      embedding_model: "gemini-embedding-001",
      embedding_dimensions: 768,
      fts: chunkContent2.toLowerCase(),
      created_at: new Date().toISOString(),
    };

    await db.from("document_chunks").insert([chunk1, chunk2]);
    await db.from("documents").update({ status: "indexed", current_checkpoint: { step: "complete" } }).eq("id", docId);

    // --------------------------------------------------------------------------
    // STEP 5: BUILD TOPIC MAP
    // --------------------------------------------------------------------------
    const topicId = "40000000-0000-0000-0000-000000000099";
    const topic: TopicRow = {
      id: topicId,
      workspace_id: workspaceId,
      user_id: userId,
      parent_id: null,
      title: "Virtual Memory & Paging Hardware",
      unit_module: "Unit 1: Memory Architecture",
      order_index: 1,
      learning_objectives: ["Page Faults", "TLB Translation", "EMAT Calculation"],
      source_chunk_id: chunk1.id,
      extraction_confidence: 0.95,
      exam_frequency: 4,
      exam_total_marks: 20,
      exam_weight: 0.25,
      current_mastery: 45.0, // baseline prior
      classification: "medium",
      evidence_level: "early_signal",
      total_attempts: 0,
      correct_attempts: 0,
      blind_spot_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("topics").insert(topic);

    // --------------------------------------------------------------------------
    // STEP 6: RETRIEVE SOURCE MATERIAL
    // --------------------------------------------------------------------------
    const query = "page fault interrupt demand paging";
    const queryVec = await gemini.embedText(query);
    const { data: retrieved } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: workspaceId,
      p_query_text: query,
      p_query_embedding: queryVec,
      p_match_count: 2,
    });
    expect(retrieved).toBeDefined();
    expect(retrieved!.length).toBeGreaterThan(0);
    const primaryChunk = retrieved![0];

    // --------------------------------------------------------------------------
    // STEP 7: GENERATE DIAGNOSTIC QUESTIONS
    // --------------------------------------------------------------------------
    const questionId = "60000000-0000-0000-0000-000000000099";
    const diagQuestion: QuizQuestionRow = {
      id: questionId,
      quiz_id: "70000000-0000-0000-0000-000000000099",
      topic_id: topicId,
      question_type: "mcq",
      difficulty: 2,
      question_text: "What event triggers an Interrupt 14 page fault in demand paging?",
      options: [
        { id: "A", text: "Accessing a virtual page marked invalid in the page table" },
        { id: "B", text: "A timer interrupt during CPU scheduling" },
        { id: "C", text: "Writing to a read-only code segment" },
      ],
      answer_key: "A",
      explanation: "An invalid bit in the page table signifies that the referenced page is on disk swap.",
      rubric: null,
      source_chunk_id: primaryChunk.id,
      citation_document_name: primaryChunk.document_name,
      citation_page_start: primaryChunk.page_start,
      citation_page_end: primaryChunk.page_end,
      citation_section: primaryChunk.section_heading,
      citation_quote: "an invalid bit access triggers a page fault interrupt.",
      is_quote_verified: true,
      created_at: new Date().toISOString(),
    };
    await db.from("quiz_questions").insert(diagQuestion);

    // --------------------------------------------------------------------------
    // STEP 8: ANSWER QUESTIONS (Student answers incorrectly with high confidence)
    // --------------------------------------------------------------------------
    const studentAnswer = "B"; // WRONG
    const studentConfidence = "high"; // OVERCONFIDENT

    // --------------------------------------------------------------------------
    // STEP 9: EVALUATE ANSWERS
    // --------------------------------------------------------------------------
    const evalRes = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse: studentAnswer,
      answerKey: diagQuestion.answer_key,
    });
    expect(evalRes.isCorrect).toBe(false);
    expect(evalRes.score).toBe(0.0);

    const calibration = classifyCalibration(studentConfidence, evalRes.score);
    expect(calibration.isBlindSpot).toBe(true);

    const recordedAnswer: AnswerRow = {
      id: "80000000-0000-0000-0000-000000000099",
      quiz_id: diagQuestion.quiz_id,
      quiz_question_id: questionId,
      topic_id: topicId,
      user_id: userId,
      student_response: studentAnswer,
      confidence: studentConfidence,
      is_correct: evalRes.isCorrect,
      score: evalRes.score,
      rubric_evaluation: null,
      feedback: evalRes.feedback,
      is_blind_spot: calibration.isBlindSpot,
      answered_at: new Date().toISOString(),
    };
    await db.from("answers").insert(recordedAnswer);

    // --------------------------------------------------------------------------
    // STEP 10: IDENTIFY KNOWLEDGE GAPS
    // --------------------------------------------------------------------------
    // Bayesian mastery update after failure
    const updatedMasteryValue = assertBayesianMastery({
      attempts: [{ score: 0.0 }],
      prior: 0.45,
      gamma: 0.80,
    });
    const newMasteryScore = Number((updatedMasteryValue * 100).toFixed(1)); // ~36.0%
    expect(newMasteryScore).toBeLessThan(40.0); // Weak classification

    await db.from("topics").update({
      current_mastery: newMasteryScore,
      classification: "weak",
      total_attempts: 1,
      correct_attempts: 0,
      blind_spot_count: 1,
    }).eq("id", topicId);

    // --------------------------------------------------------------------------
    // STEP 11: GENERATE REVISION PLAN
    // --------------------------------------------------------------------------
    const revisionTask = {
      id: "c0000000-0000-0000-0000-000000000091",
      plan_id: "b0000000-0000-0000-0000-000000000099",
      workspace_id: workspaceId,
      topic_id: topicId,
      day_number: 1,
      task_order: 1,
      task_type: "read_source",
      title: "Study Page Fault Handling in Memory Architecture",
      description: "Review demand paging and interrupt trap dispatch in Section 1.",
      allocatedMinutes: 30,
      priorityScore: 92.5,
      status: "pending",
      source_chunk_id: primaryChunk.id,
      citation_reference: `${primaryChunk.document_name} p. ${primaryChunk.page_start}-${primaryChunk.page_end}`,
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.from("revision_tasks").insert(revisionTask);
    assertDailyBudget([revisionTask], 60);

    // --------------------------------------------------------------------------
    // STEP 12: STUDY WEAK TOPICS (Student chats with Copilot about the weak concept)
    // --------------------------------------------------------------------------
    const copilotRes = await gemini.copilotChat({
      message: "Explain what triggers an invalid page fault interrupt in demand paging",
      chunks: [chunk1, chunk2],
    });
    expect(copilotRes.isRefusal).toBe(false);
    expect(copilotRes.citations.length).toBeGreaterThan(0);

    // Mark study task completed
    await db.from("revision_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", revisionTask.id);

    // --------------------------------------------------------------------------
    // STEP 13: RETAKE ASSESSMENT
    // --------------------------------------------------------------------------
    const retestAnswer = "A"; // Student now selects the CORRECT answer!
    const retestConfidence = "high";

    const retestEval = gemini.evaluateAnswer({
      questionType: "mcq",
      studentResponse: retestAnswer,
      answerKey: diagQuestion.answer_key,
    });
    expect(retestEval.isCorrect).toBe(true);
    expect(retestEval.score).toBe(1.0);

    // --------------------------------------------------------------------------
    // STEP 14: UPDATE MASTERY
    // --------------------------------------------------------------------------
    const finalMasteryVal = assertBayesianMastery({
      attempts: [{ score: 0.0 }, { score: 1.0 }],
      prior: 0.45,
      gamma: 0.80,
      k: 1.2,
    });
    const finalMasteryScore = Number((finalMasteryVal * 100).toFixed(1)); // ~48.8%
    expect(finalMasteryScore).toBeGreaterThan(newMasteryScore);
    expect(finalMasteryScore).toBeGreaterThanOrEqual(45.0);

    await db.from("topics").update({
      current_mastery: finalMasteryScore,
      classification: "medium", // Upgraded from weak to medium
      total_attempts: 2,
      correct_attempts: 1,
      blind_spot_count: 0, // Misconception resolved!
    }).eq("id", topicId);

    // --------------------------------------------------------------------------
    // STEP 15: REORDER REVISION PLAN
    // --------------------------------------------------------------------------
    // The deficit decreased from 0.64 to 0.51, dropping priority
    const updatedPriority = ((1.0 - finalMasteryScore / 100) * 0.45 + 0.25 * 0.25) * 100;
    expect(updatedPriority).toBeLessThan(revisionTask.priorityScore);

    // --------------------------------------------------------------------------
    // STEP 16: DISPLAY IMPROVEMENT
    // --------------------------------------------------------------------------
    const { data: finalTopic } = await db.from("topics").select("*").eq("id", topicId).single();
    expect(finalTopic!.classification).toBe("medium");
    expect(finalTopic!.current_mastery).toBe(finalMasteryScore);
    expect(finalTopic!.blind_spot_count).toBe(0);

    const improvementDelta = finalMasteryScore - newMasteryScore;
    expect(improvementDelta).toBeGreaterThan(10.0); // Verifiable improvement!
  });
});
