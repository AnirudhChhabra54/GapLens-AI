// ==============================================================================
// GapLens AI — Personalized Revision Planner & Greedy Daily Scheduler
// Packs prioritized revision tasks strictly within daily study time limits (Sum(min) <= M_daily).
// Enforces hard invariants: no zero/negative durations, preserves completed tasks on re-plan,
// tracks deferred tasks, and assigns targeted pedagogic task types.
// ==============================================================================

import type { TaskType, TaskStatus } from "@/types/database";
import type {
  TopicPriorityFactors,
  ScheduledTask,
  DaySchedule,
  RevisionPlanOverview,
} from "@/types/planner";

export interface PlanGenerationParams {
  planId?: string;
  workspaceId: string;
  version?: number;
  prioritizedTopics: TopicPriorityFactors[];
  dailyMinutes: number; // M_daily
  daysRemaining?: number; // Days until exam
  examDate?: string | null;
  existingTasks?: ScheduledTask[];
  topicMetadataMap?: Map<
    string,
    {
      sourceChunkId?: string | null;
      citationReference?: string | null;
      classification?: string;
    }
  >;
}

/**
 * Determines appropriate task type and duration based on topic deficit and blind spot risk.
 */
export function determineTaskProfile(topic: TopicPriorityFactors): {
  taskType: TaskType;
  durationMinutes: number;
  title: string;
  description: string;
} {
  // If high blind spot risk, prioritize conceptual review with Copilot or source reading
  if (topic.blindSpotRisk > 0.3) {
    return {
      taskType: "copilot_lesson",
      durationMinutes: 20,
      title: `Remediate Misconceptions: ${topic.topicTitle}`,
      description: `Review fundamental distinctions and resolve conceptual blind spots in ${topic.topicTitle} with Study Copilot.`,
    };
  }

  // If high mastery deficit (> 0.5, weak topic)
  if (topic.masteryDeficit > 0.45) {
    return {
      taskType: "read_source",
      durationMinutes: 25,
      title: `Core Theory & Notes: ${topic.topicTitle}`,
      description: `Read textbook and lecture notes for ${topic.topicTitle} to rebuild foundational mastery.`,
    };
  }

  // If medium deficit (0.25 - 0.45, developing topic)
  if (topic.masteryDeficit > 0.20) {
    return {
      taskType: "practice_drill",
      durationMinutes: 20,
      title: `Practice Drill: ${topic.topicTitle}`,
      description: `Solve targeted MCQs and past-paper questions for ${topic.topicTitle}.`,
    };
  }

  // Strong topic (spaced review)
  return {
    taskType: "spaced_review",
    durationMinutes: 15,
    title: `Spaced Retention Check: ${topic.topicTitle}`,
    description: `Quick formative review to maintain high retention on ${topic.topicTitle}.`,
  };
}

/**
 * Generates secondary task (e.g. retest or practice drill) for high-priority topics with sufficient time.
 */
export function determineSecondaryTaskProfile(topic: TopicPriorityFactors): {
  taskType: TaskType;
  durationMinutes: number;
  title: string;
  description: string;
} {
  if (topic.masteryDeficit > 0.40) {
    return {
      taskType: "practice_drill",
      durationMinutes: 20,
      title: `Application Drill: ${topic.topicTitle}`,
      description: `Reinforce ${topic.topicTitle} with exam-style diagnostic questions.`,
    };
  }

  return {
    taskType: "retest",
    durationMinutes: 15,
    title: `Diagnostic Retest: ${topic.topicTitle}`,
    description: `Verify mastery progression for ${topic.topicTitle} under timed conditions.`,
  };
}

/**
 * Formats a Date object to YYYY-MM-DD ISO date string.
 */
export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generates a complete, time-budget-constrained daily revision schedule.
 * Greedy packing strictly respects: Sum(allocatedMinutes) <= dailyMinutes for every single day.
 */
export function generateRevisionPlan(params: PlanGenerationParams): RevisionPlanOverview {
  const {
    planId = crypto.randomUUID(),
    workspaceId,
    version = 1,
    prioritizedTopics,
    dailyMinutes,
    daysRemaining = 7,
    examDate = null,
    existingTasks = [],
    topicMetadataMap = new Map(),
  } = params;

  const validDays = Math.max(1, daysRemaining);
  const totalAvailableMinutes = validDays * dailyMinutes;

  // Preserve completed or skipped tasks from previous plan version
  const historicalCompleted = existingTasks.filter(
    (t) => t.status === "completed" || t.status === "skipped"
  );
  const completedMinutes = historicalCompleted.reduce(
    (sum, t) => sum + (t.allocatedMinutes || 0),
    0
  );

  // Candidate task pool generated from prioritized topics (ordered by priority DESC)
  interface CandidateTask {
    topicId: string;
    topicTitle: string;
    taskType: TaskType;
    title: string;
    description: string;
    allocatedMinutes: number;
    priorityScore: number;
    sourceChunkId?: string | null;
    citationReference?: string | null;
  }

  const candidatePool: CandidateTask[] = [];

  for (const topic of prioritizedTopics) {
    const meta = topicMetadataMap.get(topic.topicId);
    const primary = determineTaskProfile(topic);

    candidatePool.push({
      topicId: topic.topicId,
      topicTitle: topic.topicTitle,
      taskType: primary.taskType,
      title: primary.title,
      description: primary.description,
      allocatedMinutes: primary.durationMinutes,
      priorityScore: topic.priorityScore,
      sourceChunkId: meta?.sourceChunkId || null,
      citationReference: meta?.citationReference || null,
    });

    // For weak or high-priority topics, schedule a follow-up drill or retest
    if (topic.priorityScore > 50 || topic.masteryDeficit > 0.35) {
      const secondary = determineSecondaryTaskProfile(topic);
      candidatePool.push({
        topicId: topic.topicId,
        topicTitle: topic.topicTitle,
        taskType: secondary.taskType,
        title: secondary.title,
        description: secondary.description,
        allocatedMinutes: secondary.durationMinutes,
        priorityScore: Math.max(0, topic.priorityScore - 5),
        sourceChunkId: meta?.sourceChunkId || null,
        citationReference: meta?.citationReference || null,
      });
    }
  }

  // Sort candidate pool by priorityScore DESC, then title ASC
  candidatePool.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return a.topicTitle.localeCompare(b.topicTitle);
  });

  // Pack daily schedules using greedy constraint packing
  const days: DaySchedule[] = [];
  const baseDate = new Date();
  let totalAllocatedAcrossDays = 0;

  // Ensure new pending task IDs are strictly collision-free with existingTasks
  const existingIds = new Set(existingTasks.map((t) => t.id));
  const scheduledCandidateIndices = new Set<number>();

  for (let dayNum = 1; dayNum <= validDays; dayNum++) {
    const scheduleDate = new Date(baseDate);
    scheduleDate.setDate(scheduleDate.getDate() + (dayNum - 1));
    const dateStr = formatISODate(scheduleDate);

    let dayAllocated = 0;
    const dayTasks: ScheduledTask[] = [];
    let taskOrder = 1;

    // Check if any completed tasks belong to this day in history
    const historicalForDay = historicalCompleted.filter((t) => t.dayNumber === dayNum);
    for (const hist of historicalForDay) {
      if (dayAllocated + hist.allocatedMinutes <= dailyMinutes) {
        dayTasks.push({ ...hist, taskOrder: taskOrder++ });
        dayAllocated += hist.allocatedMinutes;
      }
    }

    // Greedily pack unscheduled candidate tasks that fit into remaining daily budget
    for (let cIdx = 0; cIdx < candidatePool.length; cIdx++) {
      if (scheduledCandidateIndices.has(cIdx)) {
        continue;
      }

      const candidate = candidatePool[cIdx];

      // Invariant: allocatedMinutes must be strictly positive (> 0)
      if (candidate.allocatedMinutes <= 0) {
        continue;
      }

      // If a single task duration exceeds dailyMinutes, it cannot fit into any day in this plan;
      // defer it so smaller candidate tasks are not starved.
      if (candidate.allocatedMinutes > dailyMinutes) {
        continue;
      }

      // Check if candidate fits in remaining minutes of today
      if (dayAllocated + candidate.allocatedMinutes <= dailyMinutes) {
        let taskId: string;
        do {
          taskId = crypto.randomUUID();
        } while (existingIds.has(taskId));
        existingIds.add(taskId);

        dayTasks.push({
          id: taskId,
          planId,
          topicId: candidate.topicId,
          topicTitle: candidate.topicTitle,
          dayNumber: dayNum,
          taskOrder: taskOrder++,
          taskType: candidate.taskType,
          title: candidate.title,
          description: candidate.description,
          allocatedMinutes: candidate.allocatedMinutes,
          priorityScore: candidate.priorityScore,
          status: "pending",
          sourceChunkId: candidate.sourceChunkId,
          citationReference: candidate.citationReference,
        });

        dayAllocated += candidate.allocatedMinutes;
        scheduledCandidateIndices.add(cIdx);

        if (dayAllocated >= dailyMinutes) {
          break; // Day's budget is completely full
        }
      }
    }

    days.push({
      dayNumber: dayNum,
      date: dateStr,
      availableMinutes: dailyMinutes,
      allocatedMinutes: dayAllocated,
      tasks: dayTasks,
    });

    totalAllocatedAcrossDays += dayAllocated;
  }

  // Any remaining candidate tasks in the pool could not be fitted in the time budget
  const deferredTasksCount = Math.max(0, candidatePool.length - scheduledCandidateIndices.size);

  return {
    id: planId,
    workspaceId,
    version,
    examDate,
    dailyMinutes,
    totalDays: validDays,
    totalAllocatedMinutes: totalAllocatedAcrossDays,
    totalAvailableMinutes,
    completedMinutes,
    isActive: true,
    days,
    deferredTasksCount,
  };
}

/**
 * Re-plans pending revision work after a completed retest while preserving
 * completed/skipped task history. The regenerated plan uses the freshly
 * recomputed topic priorities, so weak or blind-spot topics move forward.
 */
export function updatePlanAfterRetest(params: {
  existingPlan: RevisionPlanOverview;
  prioritizedTopics: TopicPriorityFactors[];
  topicMetadataMap?: Map<
    string,
    {
      sourceChunkId?: string | null;
      citationReference?: string | null;
      classification?: string;
    }
  >;
}): RevisionPlanOverview {
  const { existingPlan, prioritizedTopics, topicMetadataMap = new Map() } = params;
  const existingTasks = existingPlan.days.flatMap((day) => day.tasks);

  return generateRevisionPlan({
    planId: existingPlan.id,
    workspaceId: existingPlan.workspaceId,
    version: existingPlan.version + 1,
    prioritizedTopics,
    dailyMinutes: existingPlan.dailyMinutes,
    daysRemaining: existingPlan.totalDays,
    examDate: existingPlan.examDate,
    existingTasks,
    topicMetadataMap,
  });
}
