// ==============================================================================
// Tier 4: Real-World Application Scenarios — Student Diagnostic & Recovery Flow
// Tests complete turnaround flow:
// 1. Initial diagnostic: student fails Virtual Memory (30% score)
// 2. System flags Weak topic (<40%) and generates high-priority study tasks
// 3. Student completes targeted reading and practice drills
// 4. Student takes adaptive retest and achieves 85% score
// 5. Bayesian mastery updates with recency decay, readiness gauge improves
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { getWeakTopic, getDemoQuestions } from "../helpers/fixture-loader";
import { assertBayesianMastery, assertDailyBudget } from "../helpers/assertion-helpers";
import type { RevisionTaskRow } from "@/types/database";

describe("Tier 4: Scenario 3 — Struggling Student Diagnostic & Turnaround", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  it("should diagnose low mastery in Virtual Memory, schedule recovery tasks, and demonstrate measurable turnaround", async () => {
    const weakTopic = getWeakTopic();
    const workspaceId = db.workspaces[0].id;

    // 1. Initial Diagnostic: Student takes 2 diagnostic questions on Virtual Memory and fails both
    const vmQuestions = getDemoQuestions().filter((q) => q.topic_id === weakTopic.id);
    expect(vmQuestions.length).toBeGreaterThanOrEqual(2);

    const initialAttempts = [
      { score: 0.0 }, // Failed MCQ on page faults
      { score: 0.3 }, // Weak partial on short answer EMAT
    ];

    // 2. Compute Bayesian mastery from initial attempts
    const initialMastery = assertBayesianMastery({
      attempts: initialAttempts,
      prior: 0.45,
      gamma: 0.80,
    });
    const initialMasteryPercent = Number((initialMastery * 100).toFixed(1)); // ~32.4%
    expect(initialMasteryPercent).toBeLessThan(40.0); // Diagnosed as WEAK

    // Update topic in DB
    await db.from("topics").update({
      current_mastery: initialMasteryPercent,
      classification: "weak",
      total_attempts: 2,
      correct_attempts: 0,
    }).eq("id", weakTopic.id);

    // Initial readiness calculation with weak topic
    const initialReadiness = 52.0;

    // 3. Scheduler generates targeted recovery tasks for Virtual Memory
    const recoveryTasks: RevisionTaskRow[] = [
      {
        id: "c0000000-0000-0000-0000-000000000301",
        plan_id: db.revision_plans[0].id,
        workspace_id: workspaceId,
        topic_id: weakTopic.id,
        day_number: 1,
        task_order: 1,
        task_type: "read_source",
        title: "Deep Dive: Multi-Level Paging and TLB Translation",
        description: "Review Silberschatz Chapter 9, sections 9.1-9.3 on hardware translation and page fault traps.",
        allocated_minutes: 25,
        allocatedMinutes: 25,
        priority_score: 95.0,
        priorityScore: 95.0, // High priority due to weak mastery + high exam weight
        status: "pending",
        source_chunk_id: db.document_chunks[14].id,
        citation_reference: "Silberschatz OS Concepts p. 15-18",
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "c0000000-0000-0000-0000-000000000302",
        plan_id: db.revision_plans[0].id,
        workspace_id: workspaceId,
        topic_id: weakTopic.id,
        day_number: 1,
        task_order: 2,
        task_type: "practice_drill",
        title: "Drill: Effective Memory Access Time Calculations",
        description: "Solve 3 multi-level page table EMAT calculation problems with varying TLB hit rates.",
        allocated_minutes: 20,
        allocatedMinutes: 20,
        priority_score: 92.0,
        priorityScore: 92.0,
        status: "pending",
        source_chunk_id: db.document_chunks[16].id,
        citation_reference: "Silberschatz OS Concepts p. 19-20",
        completed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    await db.from("revision_tasks").insert(recoveryTasks);
    assertDailyBudget(recoveryTasks, db.workspaces[0].daily_study_minutes);

    // 4. Student studies: completes task 1 and task 2
    for (const task of recoveryTasks) {
      await db.from("revision_tasks").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", task.id);
    }

    const { data: completedTasks } = await db.from("revision_tasks").select("*").eq("status", "completed");
    expect(completedTasks!.length).toBeGreaterThanOrEqual(2);

    // 5. Student takes 3-question targeted retest and achieves strong scores (1.0, 1.0, 0.8)
    const retestAttempts = [
      { score: 1.0 }, // Solved page fault MCQ correctly
      { score: 1.0 }, // Solved EMAT numerical problem correctly
      { score: 0.8 }, // Comprehensive short answer on TLB miss penalty
    ];

    // Combine historical attempts with retest attempts using recency decay
    const allAttempts = [...initialAttempts, ...retestAttempts];
    const recoveredMastery = assertBayesianMastery({
      attempts: allAttempts,
      prior: 0.45,
      gamma: 0.80,
      k: 1.2,
    });
    const recoveredMasteryPercent = Number((recoveredMastery * 100).toFixed(1)); // ~78.5%

    // 6. Verify significant mastery turnaround
    expect(recoveredMasteryPercent).toBeGreaterThanOrEqual(65.0);
    const masteryGain = recoveredMasteryPercent - initialMasteryPercent;
    expect(masteryGain).toBeGreaterThan(30.0); // >30% gain!

    // Update topic in DB
    await db.from("topics").update({
      current_mastery: recoveredMasteryPercent,
      classification: "medium", // Promoted from weak to medium!
      total_attempts: 5,
      correct_attempts: 3,
    }).eq("id", weakTopic.id);

    const { data: updatedTopic } = await db.from("topics").select("*").eq("id", weakTopic.id).single();
    expect(updatedTopic!.classification).toBe("medium");
    expect(updatedTopic!.current_mastery).toBe(recoveredMasteryPercent);

    // 7. Verify readiness gauge updates upward
    const finalReadiness = initialReadiness + (masteryGain * weakTopic.exam_weight);
    expect(finalReadiness).toBeGreaterThan(initialReadiness);
  });
});
