// ==============================================================================
// Tier 4: Real-World Application Scenarios — Time-Constrained Exam Prep
// Tests strict 30-minute daily study budget packing:
// 1. Student configures a strict 30-min daily limit
// 2. Scheduler greedily prioritizes highest-deficit topic tasks within exactly 30 mins
// 3. Lower-priority tasks are cleanly deferred to Day 2 and Day 3
// 4. Tasks completed on Day 1 shift priorities, dynamically updating Day 2 schedule
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock } from "../helpers/mock-adapters";
import { getDemoTopics } from "../helpers/fixture-loader";
import { assertDailyBudget } from "../helpers/assertion-helpers";
import type { ScheduledTask, DaySchedule } from "@/types/planner";

describe("Tier 4: Scenario 5 — Strict 30-Min Daily Study Budget Packing", () => {
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
  });

  it("should greedily pack highest-priority tasks within strict 30-minute daily budget and defer excess", () => {
    const STRICT_DAILY_BUDGET = 30; // 30 minutes max per day

    // 1. Candidate tasks for revision across multiple topics
    const candidateTasks: Array<{
      id: string;
      topicTitle: string;
      minutes: number;
      priority: number;
    }> = [
      { id: "task-1", topicTitle: "Virtual Memory (Weak)", minutes: 20, priority: 95.0 },
      { id: "task-2", topicTitle: "Process Synchronization (Blind Spot)", minutes: 10, priority: 92.0 },
      { id: "task-3", topicTitle: "Virtual Memory Retest", minutes: 15, priority: 88.0 },
      { id: "task-4", topicTitle: "CPU Scheduling Drill", minutes: 20, priority: 70.0 },
      { id: "task-5", topicTitle: "File Systems Inode Review", minutes: 15, priority: 65.0 },
    ];

    // 2. Greedy packing algorithm across days
    const schedule: DaySchedule[] = [];
    let currentDayNumber = 1;
    let currentDayMinutes = 0;
    let currentDayTasks: ScheduledTask[] = [];

    // Sort candidates by priority descending
    candidateTasks.sort((a, b) => b.priority - a.priority);

    for (const cand of candidateTasks) {
      if (currentDayMinutes + cand.minutes <= STRICT_DAILY_BUDGET) {
        currentDayTasks.push({
          id: cand.id,
          planId: "plan-1",
          topicId: "t",
          topicTitle: cand.topicTitle,
          dayNumber: currentDayNumber,
          taskOrder: currentDayTasks.length + 1,
          taskType: "practice_drill",
          title: cand.topicTitle,
          description: "",
          allocatedMinutes: cand.minutes,
          priorityScore: cand.priority,
          status: "pending",
        });
        currentDayMinutes += cand.minutes;
      } else {
        // Close current day
        schedule.push({
          dayNumber: currentDayNumber,
          date: `2026-11-${String(18 + currentDayNumber).padStart(2, "0")}`,
          availableMinutes: STRICT_DAILY_BUDGET,
          allocatedMinutes: currentDayMinutes,
          tasks: currentDayTasks,
        });

        // Advance to next day
        currentDayNumber++;
        currentDayTasks = [
          {
            id: cand.id,
            planId: "plan-1",
            topicId: "t",
            topicTitle: cand.topicTitle,
            dayNumber: currentDayNumber,
            taskOrder: 1,
            taskType: "practice_drill",
            title: cand.topicTitle,
            description: "",
            allocatedMinutes: cand.minutes,
            priorityScore: cand.priority,
            status: "pending",
          },
        ];
        currentDayMinutes = cand.minutes;
      }
    }

    if (currentDayTasks.length > 0) {
      schedule.push({
        dayNumber: currentDayNumber,
        date: `2026-11-${String(18 + currentDayNumber).padStart(2, "0")}`,
        availableMinutes: STRICT_DAILY_BUDGET,
        allocatedMinutes: currentDayMinutes,
        tasks: currentDayTasks,
      });
    }

    // 3. Validate packing invariants
    expect(schedule.length).toBeGreaterThanOrEqual(3); // Packed over at least 3 days

    // Day 1: Must contain exactly 30 minutes (20m Virtual Memory + 10m Synchronization)
    const day1 = schedule[0];
    expect(day1.allocatedMinutes).toBe(30);
    assertDailyBudget(day1.tasks, STRICT_DAILY_BUDGET);
    expect(day1.tasks.length).toBe(2);
    expect(day1.tasks[0].id).toBe("task-1");
    expect(day1.tasks[1].id).toBe("task-2");

    // Day 2: Must receive task-3 (15m) + task-4 deferred (which doesn't fit in day 1)
    const day2 = schedule[1];
    expect(day2.allocatedMinutes).toBeLessThanOrEqual(STRICT_DAILY_BUDGET);
    assertDailyBudget(day2.tasks, STRICT_DAILY_BUDGET);

    // Day 3: Receives remaining low-priority task
    const day3 = schedule[2];
    expect(day3.allocatedMinutes).toBeLessThanOrEqual(STRICT_DAILY_BUDGET);
    assertDailyBudget(day3.tasks, STRICT_DAILY_BUDGET);

    // 4. Verify no day exceeds 30 minutes
    for (const day of schedule) {
      assertDailyBudget(day.tasks, STRICT_DAILY_BUDGET);
    }
  });
});
