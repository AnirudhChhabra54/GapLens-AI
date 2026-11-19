// ==============================================================================
// GapLens AI — Revision Planner and Copilot Domain Types
// ==============================================================================

import type { TaskType, TaskStatus } from "./database";
import type { PinnedCitation } from "./rag";

export interface PriorityWeights {
  wDeficit: number; // default 0.45
  wExam: number; // default 0.25 (or 0.0 if no past papers)
  wBlind: number; // default 0.15
  wPrereq: number; // default 0.15
}

export interface TopicPriorityFactors {
  topicId: string;
  topicTitle: string;
  masteryDeficit: number; // 1.0 - (mastery / 100)
  examWeight: number; // share of past paper marks
  blindSpotRisk: number; // blind spots / max(attempts, 1)
  prerequisiteImpact: number; // downstream blocked ratio
  priorityScore: number; // 0.0 to 100.0
}

export interface ScheduledTask {
  id: string;
  planId: string;
  topicId: string;
  topicTitle: string;
  dayNumber: number;
  taskOrder: number;
  taskType: TaskType;
  title: string;
  description: string;
  allocatedMinutes: number;
  priorityScore: number;
  status: TaskStatus;
  sourceChunkId?: string | null;
  citationReference?: string | null;
  completedAt?: string | null;
}

export interface DaySchedule {
  dayNumber: number;
  date: string; // ISO date YYYY-MM-DD
  availableMinutes: number;
  allocatedMinutes: number;
  tasks: ScheduledTask[];
}

export interface RevisionPlanOverview {
  id: string;
  workspaceId: string;
  version: number;
  examDate: string | null;
  dailyMinutes: number;
  totalDays: number;
  totalAllocatedMinutes: number;
  totalAvailableMinutes: number;
  completedMinutes: number;
  isActive: boolean;
  days: DaySchedule[];
  deferredTasksCount: number;
}

export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
  citations?: PinnedCitation[];
  isRefusal?: boolean;
  timestamp?: string;
}

export interface CopilotChatRequest {
  workspaceId: string;
  message: string;
  topicId?: string;
  history?: CopilotMessage[];
}

export interface CopilotChatResponse {
  answer: string;
  citations: PinnedCitation[];
  isRefusal: boolean;
  refusalReason?: string;
}
