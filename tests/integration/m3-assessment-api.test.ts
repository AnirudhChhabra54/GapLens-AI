// ==============================================================================
// M3 Integration: Assessment APIs, ownership, calibration, and retest output
// Runs against the explicitly labelled offline demo path. Live Supabase writes
// remain unverified because this repository has no service-role credentials.
// ==============================================================================

import { beforeAll, describe, expect, it } from "vitest";
import { POST as evaluateQuiz } from "@/app/api/quiz/evaluate/route";
import { GET as getGapReport } from "@/app/api/gap-report/route";
import { POST as signUpload } from "@/app/api/upload/sign/route";
import { authorizeWorkspace } from "@/lib/supabase/auth";

const DEMO_WORKSPACE = "10000000-0000-0000-0000-000000000001";
const DEMO_QUIZ = "70000000-0000-0000-0000-000000000001";
const UNKNOWN_WORKSPACE = "99999999-0000-0000-0000-000000000001";

function evaluateRequest(body: unknown) {
  return new Request("http://localhost:3000/api/quiz/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("M3 API: workspace ownership", () => {
  it("authorizes only the synthetic demo workspace offline", async () => {
    const demo = await authorizeWorkspace(DEMO_WORKSPACE);
    expect(demo).toMatchObject({ ok: true, isDemo: true });

    const foreign = await authorizeWorkspace(UNKNOWN_WORKSPACE);
    expect(foreign).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects quiz evaluation for a foreign workspace", async () => {
    const res = await evaluateQuiz(
      evaluateRequest({
        quizId: DEMO_QUIZ,
        workspaceId: UNKNOWN_WORKSPACE,
        answers: [
          {
            questionId: "80000000-0000-0000-0000-000000000001",
            response: "C",
            confidence: "high",
          },
        ],
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects gap-report access for a foreign workspace", async () => {
    const res = await getGapReport(
      new Request(`http://localhost:3000/api/gap-report?workspaceId=${UNKNOWN_WORKSPACE}`)
    );
    expect(res.status).toBe(401);
  });

  it("rejects upload signing for a foreign workspace", async () => {
    const res = await signUpload(
      new Request("http://localhost:3000/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: UNKNOWN_WORKSPACE,
          filename: "notes.pdf",
          fileType: "application/pdf",
          declaredSizeBytes: 1024,
          docType: "material",
        }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects questions that do not belong to the demo quiz", async () => {
    const res = await evaluateQuiz(
      evaluateRequest({
        quizId: DEMO_QUIZ,
        workspaceId: DEMO_WORKSPACE,
        answers: [
          {
            questionId: "88888888-8888-8888-8888-888888888888",
            response: "A",
            confidence: "medium",
          },
        ],
      })
    );
    expect(res.status).toBe(400);
  });
});

describe("M3 API: evidence-aware evaluation output", () => {
  it("returns mastery deltas with evidence, attempts, and blind-spot detection", async () => {
    const res = await evaluateQuiz(
      evaluateRequest({
        quizId: DEMO_QUIZ,
        workspaceId: DEMO_WORKSPACE,
        answers: [
          {
            questionId: "80000000-0000-0000-0000-000000000001",
            response: "C",
            confidence: "high",
          },
          {
            questionId: "80000000-0000-0000-0000-000000000002",
            response: "A TLB miss and a page fault are both handled by the OS kernel from disk.",
            confidence: "medium",
          },
          {
            questionId: "80000000-0000-0000-0000-000000000003",
            response: "A",
            confidence: "high",
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isDemo).toBe(true);
    expect(data.persisted).toBe(false);
    expect(data.newBlindSpotsCount).toBeGreaterThanOrEqual(1);

    const weakAnswer = data.answers.find(
      (a: any) => a.questionId === "80000000-0000-0000-0000-000000000003"
    );
    expect(weakAnswer.isBlindSpot).toBe(true);
    expect(weakAnswer.score).toBeLessThan(0.5);

    const delta = data.masteryDeltas["40000000-0000-0000-0000-000000000006"];
    expect(delta).toBeDefined();
    expect(delta.evidenceLevel).toBeTruthy();
    expect(delta.totalAttempts).toBeGreaterThan(0);
    expect(delta.correctAttempts).toBeGreaterThanOrEqual(0);
    expect(delta.current).toBeLessThan(delta.previous);
  });

  it("returns calibration metrics and reconstructed topic mastery in the gap report", async () => {
    const res = await getGapReport(
      new Request(`http://localhost:3000/api/gap-report?workspaceId=${DEMO_WORKSPACE}`)
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.isDemo).toBe(true);
    expect(data.topics).toHaveLength(10);
    expect(data.readiness.assessedTopicsCount).toBeGreaterThan(0);

    const calibration = data.blindSpots.calibration;
    expect(calibration).toBeDefined();
    expect(calibration.totalAnswers).toBeGreaterThan(0);
    expect(calibration.highConfidenceErrorRate).toBeGreaterThanOrEqual(0);
    expect(calibration.lowConfidenceCorrectRate).toBeGreaterThanOrEqual(0);
    expect(typeof calibration.sampleSufficient).toBe("boolean");

    const reconstructed = data.topics.find(
      (t: any) => t.topicId === "40000000-0000-0000-0000-000000000005"
    );
    expect(reconstructed.totalAttempts).toBeGreaterThan(0);
    expect(reconstructed.evidenceLevel).toBeTruthy();
  });
});
