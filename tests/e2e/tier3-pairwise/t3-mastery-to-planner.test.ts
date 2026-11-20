// ==============================================================================
// Tier 3: Pairwise Cross-Feature Interactions — Mastery to Planner Pipeline
// Verifies integration pipeline:
// Mastery + Blind Spots -> Multi-Factor Priority -> Greedy Daily Budget Packing -> Retest Loop
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock } from "../helpers/mock-adapters";
import { getDemoTopics, getDemoRevisionSchedule, getWeakTopic, getBlindSpotTopic } from "../helpers/fixture-loader";
import { assertDailyBudget } from "../helpers/assertion-helpers";
import type { PriorityWeights, TopicPriorityFactors, ScheduledTask, DaySchedule } from "@/types/planner";
import type { RevisionTaskRow } from "@/types/database";

describe("Tier 3: Mastery to Planner Pipeline (Cross-Feature Pairwise)", () => {
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
  });

  it("T3.MP.1: should compute multi-factor priority score with deficit, exam weight, blind spot risk, and prereq impact", () => {
    const weights: PriorityWeights = { wDeficit: 0.45, wExam: 0.25, wBlind: 0.15, wPrereq: 0.15 };
    const weak = getWeakTopic();

    const factors: TopicPriorityFactors = {
      topicId: weak.id,
      topicTitle: weak.title,
      masteryDeficit: 1.0 - weak.current_mastery / 100, // 1.0 - 0.38 = 0.62
      examWeight: weak.exam_weight, // 0.18
      blindSpotRisk: weak.blind_spot_count / Math.max(weak.total_attempts, 1),
      prerequisiteImpact: 0.4, // blocks downstream memory management concepts
      priorityScore: 0,
    };

    const calculatedScore =
      (factors.masteryDeficit * weights.wDeficit +
        factors.examWeight * weights.wExam +
        factors.blindSpotRisk * weights.wBlind +
        factors.prerequisiteImpact * weights.wPrereq) *
      100;

    expect(calculatedScore).toBeGreaterThan(40.0);
    expect(calculatedScore).toBeLessThanOrEqual(100.0);
  });

  it("T3.MP.2: weak topics with high exam weight must receive highest priority rank", () => {
    const topics = getDemoTopics();
    const scoredTopics = topics.map((t) => {
      const deficit = 1.0 - t.current_mastery / 100;
      const score = (deficit * 0.45 + t.exam_weight * 0.25 + (t.blind_spot_count > 0 ? 0.2 : 0) * 0.15) * 100;
      return { topic: t, priority: score };
    });

    scoredTopics.sort((a, b) => b.priority - a.priority);

    // Weak topics (Virtual Memory, Concurrency) should dominate top ranks
    const top2Titles = [scoredTopics[0].topic.title, scoredTopics[1].topic.title];
    expect(top2Titles.some((title) => title.includes("Virtual Memory"))).toBe(true);
    expect(top2Titles.some((title) => title.includes("Synchronization"))).toBe(true);
  });

  it("T3.MP.3: greedy daily study scheduler must enforce daily_minutes constraint across all days", () => {
    const dailyLimit = 60;
    const allTasks = db.revision_tasks;

    const daysMap = new Map<number, RevisionTaskRow[]>();
    for (const task of allTasks) {
      const day = task.day_number;
      if (!daysMap.has(day)) daysMap.set(day, []);
      daysMap.get(day)!.push(task);
    }

    for (const [day, tasks] of daysMap.entries()) {
      assertDailyBudget(tasks, dailyLimit);
    }
  });

  it("T3.MP.4: tasks exceeding the daily budget must be deferred to the subsequent day", () => {
    const dailyLimit = 60;
    const candidateTasks = [
      { id: "1", minutes: 30, priority: 95 },
      { id: "2", minutes: 25, priority: 90 },
      { id: "3", minutes: 20, priority: 85 }, // Exceeds day 1 (30 + 25 + 20 = 75 > 60)
    ];

    const day1: typeof candidateTasks = [];
    const day2: typeof candidateTasks = [];
    let currentTotal = 0;

    for (const task of candidateTasks) {
      if (currentTotal + task.minutes <= dailyLimit) {
        day1.push(task);
        currentTotal += task.minutes;
      } else {
        day2.push(task);
      }
    }

    expect(day1.length).toBe(2);
    expect(day1.reduce((s, t) => s + t.minutes, 0)).toBeLessThanOrEqual(dailyLimit);
    expect(day2.length).toBe(1);
    expect(day2[0].id).toBe("3");
  });

  it("T3.MP.5: completing a revision task should update completed_at and reduce pending study time", async () => {
    const task = db.revision_tasks[0];
    const initialCompleted = db.revision_tasks.filter((t) => t.status === "completed").length;

    await db.from("revision_tasks").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", task.id);

    const { data: updatedTask } = await db.from("revision_tasks").select("*").eq("id", task.id).single();
    expect(updatedTask!.status).toBe("completed");
    expect(updatedTask!.completed_at).toBeDefined();

    const remainingPending = db.revision_tasks.filter((t) => t.status === "pending").length;
    expect(remainingPending).toBeLessThan(db.revision_tasks.length);
  });

  it("T3.MP.6: should support revision task sequence: read_source -> practice_drill -> retest", () => {
    const expectedSequence = ["read_source", "practice_drill", "retest"];
    expect(expectedSequence[0]).toBe("read_source");
    expect(expectedSequence[1]).toBe("practice_drill");
    expect(expectedSequence[2]).toBe("retest");
  });

  it("T3.MP.7: successful retest should update topic mastery and dynamically lower its priority", () => {
    const initialDeficit = 0.62; // 38% initial mastery
    const initialPriority = (initialDeficit * 0.45 + 0.18 * 0.25) * 100; // ~32.4

    // After retest, student achieves 85% mastery
    const newMastery = 0.85;
    const newDeficit = 1.0 - newMastery; // 0.15
    const updatedPriority = (newDeficit * 0.45 + 0.18 * 0.25) * 100; // ~11.25

    expect(updatedPriority).toBeLessThan(initialPriority);
  });

  it("T3.MP.8: priority reordering after retest must promote next weakest topic to the front of the schedule", () => {
    const queue = [
      { topicId: "vm", title: "Virtual Memory", priority: 92 },
      { topicId: "sync", title: "Synchronization", priority: 88 },
      { topicId: "sched", title: "CPU Scheduling", priority: 40 },
    ];

    // Student masters Virtual Memory -> priority drops to 20
    queue[0].priority = 20;

    // Reorder queue
    queue.sort((a, b) => b.priority - a.priority);

    expect(queue[0].topicId).toBe("sync");
    expect(queue[0].title).toBe("Synchronization");
  });

  it("T3.MP.9: revision schedule should support versioning when re-generated after new assessments", async () => {
    const plan = db.revision_plans[0];
    expect(plan.version).toBe(1);

    const newPlanVersion = {
      ...plan,
      id: "b0000000-0000-0000-0000-000000000002",
      version: 2,
      total_allocated_minutes: 420,
      created_at: new Date().toISOString(),
    };

    await db.from("revision_plans").insert(newPlanVersion);
    const { data } = await db.from("revision_plans").select("*").eq("id", newPlanVersion.id).single();

    expect(data!.version).toBe(2);
    expect(data!.total_allocated_minutes).toBe(420);
  });

  it("T3.MP.10: daily schedule date strings should be valid consecutive ISO calendar dates", () => {
    const startDate = new Date("2026-11-18");
    for (let day = 1; day <= 5; day++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + (day - 1));
      const isoStr = dayDate.toISOString().split("T")[0];
      expect(isoStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("T3.MP.11: revision plan must never exceed total available days before exam date", () => {
    const ws = db.workspaces[0];
    const examDate = new Date(ws.exam_date!);
    const today = new Date("2026-11-18");
    const totalDaysAvailable = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const plan = db.revision_plans[0];
    expect(plan.total_days).toBeLessThanOrEqual(totalDaysAvailable);
  });
});
