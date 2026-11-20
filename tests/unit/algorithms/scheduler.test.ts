// ==============================================================================
// Unit Test: Revision Planner & Scheduler Engine
// Verifies greedy daily packing constraint (Sum(min) <= dailyMinutes), strictly positive
// task durations, preservation of completed tasks, deferred task tracking, and pedagogic task types.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  generateRevisionPlan,
  updatePlanAfterRetest,
  determineTaskProfile,
  formatISODate,
} from "@/lib/algorithms/scheduler";
import type { TopicPriorityFactors, ScheduledTask } from "@/types/planner";

describe("Unit: Revision Planner & Scheduler Engine (scheduler.ts)", () => {
  const mockTopics: TopicPriorityFactors[] = [
    {
      topicId: "t-1",
      topicTitle: "Virtual Memory Paging",
      masteryDeficit: 0.65,
      examWeight: 0.25,
      blindSpotRisk: 0.50,
      prerequisiteImpact: 0.30,
      priorityScore: 92.0,
    },
    {
      topicId: "t-2",
      topicTitle: "Concurrency & Mutexes",
      masteryDeficit: 0.40,
      examWeight: 0.20,
      blindSpotRisk: 0.20,
      prerequisiteImpact: 0.40,
      priorityScore: 75.0,
    },
    {
      topicId: "t-3",
      topicTitle: "CPU Scheduling Algorithms",
      masteryDeficit: 0.15,
      examWeight: 0.10,
      blindSpotRisk: 0.0,
      prerequisiteImpact: 0.10,
      priorityScore: 30.0,
    },
  ];

  describe("Pedagogic Task Profiling", () => {
    it("should assign copilot_lesson for topics with high blind spot risk", () => {
      const profile = determineTaskProfile(mockTopics[0]); // blindSpotRisk = 0.50
      expect(profile.taskType).toBe("copilot_lesson");
      expect(profile.durationMinutes).toBeGreaterThan(0);
    });

    it("should assign read_source for weak topics with high deficit", () => {
      const weakTopic: TopicPriorityFactors = {
        ...mockTopics[0],
        blindSpotRisk: 0.1, // low blind spot, high deficit (0.65)
      };
      const profile = determineTaskProfile(weakTopic);
      expect(profile.taskType).toBe("read_source");
      expect(profile.durationMinutes).toBeGreaterThan(0);
    });

    it("should assign spaced_review for mastered strong topics", () => {
      const strongTopic: TopicPriorityFactors = {
        ...mockTopics[2],
        masteryDeficit: 0.05,
      };
      const profile = determineTaskProfile(strongTopic);
      expect(profile.taskType).toBe("spaced_review");
    });
  });

  describe("Greedy Daily Time-Budget Packing Invariant", () => {
    it("should strictly respect Sum(allocatedMinutes) <= dailyMinutes for EVERY day", () => {
      const dailyMinutes = 45;
      const daysRemaining = 5;

      const plan = generateRevisionPlan({
        workspaceId: "ws-1",
        prioritizedTopics: mockTopics,
        dailyMinutes,
        daysRemaining,
      });

      expect(plan.days.length).toBe(daysRemaining);
      expect(plan.dailyMinutes).toBe(dailyMinutes);

      for (const day of plan.days) {
        const sumMinutes = day.tasks.reduce((sum, t) => sum + t.allocatedMinutes, 0);
        expect(sumMinutes).toBeLessThanOrEqual(dailyMinutes);
        expect(day.allocatedMinutes).toBe(sumMinutes);
      }
    });

    it("should ensure all scheduled task durations are strictly positive (> 0)", () => {
      const plan = generateRevisionPlan({
        workspaceId: "ws-1",
        prioritizedTopics: mockTopics,
        dailyMinutes: 60,
        daysRemaining: 3,
      });

      for (const day of plan.days) {
        for (const task of day.tasks) {
          expect(task.allocatedMinutes).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Preservation of History and Deferred Tasks", () => {
    it("should preserve completed tasks when re-generating a plan", () => {
      const completedTask: ScheduledTask = {
        id: "task-hist-1",
        planId: "old-plan",
        topicId: "t-1",
        topicTitle: "Virtual Memory Paging",
        dayNumber: 1,
        taskOrder: 1,
        taskType: "read_source",
        title: "Read notes",
        description: "",
        allocatedMinutes: 25,
        priorityScore: 90,
        status: "completed",
        completedAt: new Date().toISOString(),
      };

      const plan = generateRevisionPlan({
        workspaceId: "ws-1",
        prioritizedTopics: mockTopics,
        dailyMinutes: 60,
        daysRemaining: 3,
        existingTasks: [completedTask],
      });

      const day1 = plan.days.find((d) => d.dayNumber === 1)!;
      expect(day1.tasks.some((t) => t.id === "task-hist-1" && t.status === "completed")).toBe(true);
      expect(plan.completedMinutes).toBe(25);
    });

    it("should track deferredTasksCount when workload exceeds tight daily budget", () => {
      const plan = generateRevisionPlan({
        workspaceId: "ws-1",
        prioritizedTopics: mockTopics,
        dailyMinutes: 15, // Very tight budget
        daysRemaining: 1, // Only 1 day
      });

      expect(plan.days[0].tasks.length).toBeLessThanOrEqual(1);
      expect(plan.deferredTasksCount).toBeGreaterThan(0);
    });
  });

  describe("Date Formatting Helper", () => {
    it("should format dates in ISO YYYY-MM-DD", () => {
      const date = new Date(2026, 10, 18); // Nov 18, 2026
      expect(formatISODate(date)).toBe("2026-11-18");
    });
  });
  describe("Automatic Re-planning After Retesting", () => {
    const existingPlan = generateRevisionPlan({
      planId: "plan-retest",
      workspaceId: "ws-retest",
      version: 1,
      prioritizedTopics: mockTopics,
      dailyMinutes: 60,
      daysRemaining: 4,
    });

    it("should bump the plan version and preserve completed history", () => {
      const completed: ScheduledTask = {
        id: "completed-1",
        planId: existingPlan.id,
        topicId: "t-1",
        topicTitle: "Virtual Memory Paging",
        dayNumber: 1,
        taskOrder: 1,
        taskType: "read_source",
        title: "Read notes",
        description: "",
        allocatedMinutes: 20,
        priorityScore: 90,
        status: "completed",
        completedAt: "2026-11-19T10:00:00.000Z",
      };
      const planWithHistory = {
        ...existingPlan,
        days: existingPlan.days.map((d) =>
          d.dayNumber === 1 ? { ...d, tasks: [completed, ...d.tasks] } : d
        ),
      };

      const updated = updatePlanAfterRetest({
        existingPlan: planWithHistory,
        prioritizedTopics: mockTopics,
      });

      expect(updated.version).toBe(2);
      expect(updated.id).toBe(existingPlan.id);
      expect(updated.days[0].tasks.some((t) => t.id === "completed-1" && t.status === "completed")).toBe(true);
      for (const day of updated.days) {
        const sum = day.tasks.reduce((acc, t) => acc + t.allocatedMinutes, 0);
        expect(sum).toBeLessThanOrEqual(updated.dailyMinutes);
      }
    });

    it("should move a newly weak topic ahead of previously scheduled pending work", () => {
      const retestedTopics: TopicPriorityFactors[] = [
        { ...mockTopics[2], masteryDeficit: 0.9, blindSpotRisk: 0.6, priorityScore: 100 },
        mockTopics[0],
        mockTopics[1],
      ];

      const updated = updatePlanAfterRetest({
        existingPlan,
        prioritizedTopics: retestedTopics,
      });

      expect(updated.days[0].tasks[0].topicId).toBe("t-3");
    });

    it("should guarantee collision-free unique task IDs when replanning with historical tasks", () => {
      const plan = generateRevisionPlan({
        planId: "p1",
        workspaceId: "ws-1",
        dailyMinutes: 60,
        daysRemaining: 2,
        prioritizedTopics: [
          {
            topicId: "t2",
            topicTitle: "Process Synchronization",
            priorityScore: 80,
            masteryDeficit: 0.3,
            blindSpotRisk: 0.1,
            examWeight: 1.0,
            prerequisiteImpact: 0.2,
          },
        ],
        existingTasks: [
          {
            id: "task-p1-1-1",
            planId: "p1",
            topicId: "t1",
            topicTitle: "Virtual Memory",
            dayNumber: 1,
            taskOrder: 1,
            taskType: "read_source",
            title: "Read VM Notes",
            description: "Read",
            allocatedMinutes: 20,
            priorityScore: 90,
            status: "completed",
          },
        ],
      });

      const allIds = plan.days.flatMap((d) => d.tasks.map((t) => t.id));
      expect(new Set(allIds).size).toBe(allIds.length);
      const pendingIds = plan.days.flatMap((d) =>
        d.tasks.filter((t) => t.status === "pending").map((t) => t.id)
      );
      expect(pendingIds).not.toContain("task-p1-1-1");
    });

    it("should prevent Head-of-Line starvation when top-priority task exceeds daily budget", () => {
      const tightPlan = generateRevisionPlan({
        workspaceId: "ws-tight",
        dailyMinutes: 15, // 15-minute tight budget
        daysRemaining: 3,
        prioritizedTopics: [
          {
            topicId: "t-weak-big",
            topicTitle: "Big Weak Topic",
            masteryDeficit: 0.70, // will generate 25-minute read_source
            examWeight: 0.5,
            blindSpotRisk: 0.1,
            prerequisiteImpact: 0.3,
            priorityScore: 95.0,
          },
          {
            topicId: "t-small",
            topicTitle: "Spaced Retention Check",
            masteryDeficit: 0.05, // will generate 15-minute spaced_review
            examWeight: 0.2,
            blindSpotRisk: 0.0,
            prerequisiteImpact: 0.1,
            priorityScore: 50.0,
          },
        ],
      });

      // The 25-minute task cannot fit in 15-minute daily budget, but the 15-minute task MUST be scheduled
      expect(tightPlan.totalAllocatedMinutes).toBeGreaterThan(0);
      expect(tightPlan.days[0].tasks.length).toBeGreaterThan(0);
      expect(tightPlan.days[0].allocatedMinutes).toBe(15);
      expect(tightPlan.days[0].tasks[0].topicId).toBe("t-small");
      expect(tightPlan.deferredTasksCount).toBeGreaterThan(0);
    });

    it("should support large daily study budgets up to 24 hours (1440 minutes)", () => {
      const largeBudgetPlan = generateRevisionPlan({
        workspaceId: "ws-test",
        prioritizedTopics: mockTopics,
        dailyMinutes: 1440, // 24 hours
        daysRemaining: 3,
      });

      expect(largeBudgetPlan.dailyMinutes).toBe(1440);
      expect(largeBudgetPlan.totalAvailableMinutes).toBe(1440 * 3);
      expect(largeBudgetPlan.deferredTasksCount).toBe(0);
      for (const day of largeBudgetPlan.days) {
        expect(day.availableMinutes).toBe(1440);
        expect(day.allocatedMinutes).toBeLessThanOrEqual(1440);
      }
    });
  });
});
