// ==============================================================================
// Tier 4: Real-World Application Scenarios — OS CS-301 Judge Demonstration
// Verifies instant 1-click judge access (demo@gapfinder.ai), loading 10 OS topics,
// historical quiz attempts, hero gap report, and priority revision tasks with zero latency.
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock } from "../helpers/mock-adapters";
import {
  getDemoProfile,
  getDemoWorkspace,
  getDemoDocuments,
  getDemoTopics,
  getDemoPrerequisites,
  getDemoChunks,
  getDemoQuestions,
  getDemoAnswers,
  getDemoGapReport,
  getWeakTopic,
  getBlindSpotTopic,
} from "../helpers/fixture-loader";
import { assert768dEmbedding, assertDailyBudget } from "../helpers/assertion-helpers";

describe("Tier 4: Scenario 2 — OS CS-301 Pre-Seeded Judge Demonstration", () => {
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
  });

  it("should instantly load the pre-seeded OS CS-301 demo experience with complete data consistency", async () => {
    const startTime = Date.now();

    // 1. One-click judge auth
    const profile = getDemoProfile();
    expect(profile.email).toBe("demo@gapfinder.ai");
    expect(profile.full_name).toContain("Alex Chen");

    // 2. Fetch workspace
    const workspace = getDemoWorkspace();
    expect(workspace.title).toBe("Operating Systems (CS-301)");
    expect(workspace.daily_study_minutes).toBe(60);

    // 3. Fetch documents
    const documents = getDemoDocuments();
    expect(documents.length).toBeGreaterThanOrEqual(2);
    expect(documents.every((d) => d.status === "indexed")).toBe(true);

    // 4. Fetch 10 OS topics
    const topics = getDemoTopics();
    expect(topics.length).toBe(10);
    const weakTopics = topics.filter((t) => t.classification === "weak");
    expect(weakTopics.length).toBeGreaterThanOrEqual(2); // Virtual Memory & Synchronization

    // 5. Fetch chunks and verify embeddings
    const chunks = getDemoChunks();
    expect(chunks.length).toBe(20);
    for (const chunk of chunks) {
      assert768dEmbedding(chunk.embedding);
    }

    // 6. Fetch diagnostic questions & historical attempts
    const questions = getDemoQuestions();
    const answers = getDemoAnswers();
    expect(questions.length).toBe(15);
    expect(answers.length).toBeGreaterThanOrEqual(3);

    // 7. Inspect Hero Gap Report
    const gapReport = getDemoGapReport();
    expect(gapReport.readiness.readinessScore).toBeGreaterThan(60);
    expect(gapReport.readiness.isDataSufficient).toBe(true);
    expect(gapReport.blindSpots.totalBlindSpots).toBe(1);

    // Verify blind spot topic is Process Synchronization
    const blindSpotItem = gapReport.blindSpots.items[0];
    expect(blindSpotItem.topicTitle).toContain("Synchronization");
    expect(blindSpotItem.confidence).toBe("high");
    expect(blindSpotItem.evidenceQuote).toContain("out-of-order processors");

    // 8. Fetch active revision plan & scheduled tasks
    const { data: activeTasks } = await db.from("revision_tasks").select("*").eq("day_number", 1);
    expect(activeTasks).toBeDefined();
    expect(activeTasks!.length).toBeGreaterThan(0);
    assertDailyBudget(activeTasks!, workspace.daily_study_minutes);

    // 9. Verify instant execution invariant (< 500ms)
    const elapsedMs = Date.now() - startTime;
    expect(elapsedMs).toBeLessThan(500);
  });
});
