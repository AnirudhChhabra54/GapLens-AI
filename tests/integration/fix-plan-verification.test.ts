// ==============================================================================
// Fix Plan Verification Integration Tests
// Validates all contracts introduced in fix.md:
// 1. Demo quiz generate -> evaluate marks wrong answers with 0 score (zero leak & integrity)
// 2. Exam mode accepted in /api/quiz/generate
// 3. Multi-paper mapping yields aggregate weights without duplicating rows
// 4. PATCH /api/planner/tasks status updates
// 5. PATCH /api/workspaces/[id] settings updates
// 6. DELETE /api/documents/[id] and POST /api/documents/[id]/reindex
// 7. GET /api/topics/tree returns hierarchical topic tree
// ==============================================================================

import { beforeAll, describe, expect, it } from "vitest";
import { POST as generateQuiz } from "@/app/api/quiz/generate/route";
import { POST as evaluateQuiz } from "@/app/api/quiz/evaluate/route";
import { GET as getTopicTree } from "@/app/api/topics/tree/route";
import { PATCH as updateTask } from "@/app/api/planner/tasks/route";
import { PATCH as updateWorkspace } from "@/app/api/workspaces/[id]/route";
import { DELETE as deleteDocument } from "@/app/api/documents/[id]/route";
import { POST as reindexDocument } from "@/app/api/documents/[id]/reindex/route";
import { computeTopicExamWeights } from "@/lib/algorithms/topic-mapper";

const DEMO_WORKSPACE = "10000000-0000-0000-0000-000000000001";
const UNKNOWN_WORKSPACE = "99999999-0000-0000-0000-000000000001";

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("Fix Plan Verification — API Contracts & Regressions", () => {
  // 1. Demo quiz generation and strict evaluation
  it("demo quiz generate -> evaluate marks wrong answers with 0 score", async () => {
    const genReq = new Request("http://localhost:3000/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: DEMO_WORKSPACE,
        targetCount: 2,
        quizMode: "diagnostic",
      }),
    });

    const genRes = await generateQuiz(genReq);
    expect(genRes.status).toBe(200);
    const genData = await genRes.json();
    expect(genData.success).toBe(true);
    expect(genData.quizId).toBeDefined();
    expect(genData.questions.length).toBeGreaterThan(0);

    const firstQ = genData.questions[0];
    // Intentionally submit an incorrect answer
    const evalReq = new Request("http://localhost:3000/api/quiz/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId: genData.quizId,
        workspaceId: DEMO_WORKSPACE,
        answers: [
          {
            questionId: firstQ.id,
            response: "Z_DEFINITELY_WRONG_OPTION",
            confidence: "high",
            questionText: firstQ.questionText,
            questionType: firstQ.questionType,
            options: firstQ.options,
            topicId: firstQ.topicId,
          },
        ],
      }),
    });

    const evalRes = await evaluateQuiz(evalReq);
    expect(evalRes.status).toBe(200);
    const evalData = await evalRes.json();
    expect(evalData.answers).toBeDefined();
    expect(evalData.answers[0].isCorrect).toBe(false);
    expect(evalData.answers[0].score).toBe(0);
    // Verified: high-confidence mistake identified as blind spot
    expect(evalData.answers[0].isBlindSpot).toBe(true);
  });

  // 2. Exam mode accepted in /api/quiz/generate
  it("accepts exam mode in /api/quiz/generate", async () => {
    const examReq = new Request("http://localhost:3000/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: DEMO_WORKSPACE,
        targetCount: 3,
        quizMode: "exam",
      }),
    });

    const res = await examReq;
    const response = await generateQuiz(examReq);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.quizMode).toBe("exam");
  });

  // 3. Multi-paper mapping yields aggregate weights without duplicating rows
  it("computes aggregate exam weights accurately without inventing marks", () => {
    const questions = [
      {
        id: "q1",
        workspace_id: DEMO_WORKSPACE,
        document_id: "doc-1",
        mapped_topic_id: "topic-1",
        question_number: "Q1",
        marks: 10,
        mapping_confidence: 0.9,
        needs_review: false,
        created_at: new Date().toISOString(),
      },
      {
        id: "q2",
        workspace_id: DEMO_WORKSPACE,
        document_id: "doc-2",
        mapped_topic_id: "topic-2",
        question_number: "Q1",
        marks: 30,
        mapping_confidence: 0.95,
        needs_review: false,
        created_at: new Date().toISOString(),
      },
    ];

    const sampleTopics = [
      { id: "topic-1", title: "Topic 1", exam_weight: 0 } as any,
      { id: "topic-2", title: "Topic 2", exam_weight: 0 } as any,
    ];
    const weights = computeTopicExamWeights(sampleTopics, questions as any);
    expect(weights.get("topic-1")?.examWeight).toBeCloseTo(0.25, 2);
    expect(weights.get("topic-2")?.examWeight).toBeCloseTo(0.75, 2);
  });

  // 4. PATCH /api/planner/tasks
  it("updates task status via PATCH /api/planner/tasks", async () => {
    const taskId = "50000000-0000-0000-0000-000000000001";
    const req = new Request("http://localhost:3000/api/planner/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: DEMO_WORKSPACE,
        taskId,
        status: "completed",
      }),
    });

    const res = await updateTask(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe("completed");
    expect(data.taskId).toBe(taskId);
  });

  it("rejects task updates for unknown workspace", async () => {
    const req = new Request("http://localhost:3000/api/planner/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: UNKNOWN_WORKSPACE,
        taskId: "50000000-0000-0000-0000-000000000001",
        status: "completed",
      }),
    });

    const res = await updateTask(req);
    expect(res.status).toBe(401);
  });

  // 5. PATCH /api/workspaces/[id]
  it("updates workspace settings via PATCH /api/workspaces/[id]", async () => {
    const req = new Request(`http://localhost:3000/api/workspaces/${DEMO_WORKSPACE}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Advanced Operating Systems",
        daily_study_minutes: 90,
      }),
    });

    const res = await updateWorkspace(req, {
      params: { id: DEMO_WORKSPACE },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.workspace.title).toBe("Advanced Operating Systems");
    expect(data.workspace.daily_study_minutes).toBe(90);
  });

  // 6. DELETE /api/documents/[id] and POST /api/documents/[id]/reindex
  it("handles document deletion and re-indexing endpoints", async () => {
    const docId = "30000000-0000-0000-0000-000000000001";

    const deleteReq = new Request(
      `http://localhost:3000/api/documents/${docId}?workspaceId=${DEMO_WORKSPACE}`,
      { method: "DELETE" }
    );
    const deleteRes = await deleteDocument(deleteReq, {
      params: { id: docId },
    });
    expect(deleteRes.status).toBe(200);
    const deleteData = await deleteRes.json();
    expect(deleteData.success).toBe(true);

    const reindexReq = new Request(`http://localhost:3000/api/documents/${docId}/reindex`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: DEMO_WORKSPACE }),
    });
    const reindexRes = await reindexDocument(reindexReq, {
      params: { id: docId },
    });
    expect(reindexRes.status).toBe(200);
    const reindexData = await reindexRes.json();
    expect(reindexData.success).toBe(true);
  });

  // 7. GET /api/topics/tree
  it("returns hierarchical topic tree via GET /api/topics/tree", async () => {
    const req = new Request(
      `http://localhost:3000/api/topics/tree?workspaceId=${DEMO_WORKSPACE}`
    );
    const res = await getTopicTree(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.tree)).toBe(true);
    expect(data.tree.length).toBeGreaterThan(0);
  });
});
