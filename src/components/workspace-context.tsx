"use client";

// ==============================================================================
// GapLens AI — Client Workspace & Session Context
// Manages active student profile, workspace selection, 1-Click Judge Demo state,
// daily study time budget, and interactive task completion persistence.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  DEMO_PROFILE,
  DEMO_WORKSPACE,
  DEMO_DOCUMENTS,
  DEMO_TOPICS,
  DEMO_PREREQUISITES,
  DEMO_REVISION_SCHEDULE,
} from "@/lib/demo/os-cs301-fixture";
import type {
  ProfileRow,
  WorkspaceRow,
  DocumentRow,
  TopicRow,
  TopicPrerequisiteRow,
  MasteryClassification,
  EvidenceStrength,
} from "@/types/database";
import type { AssessmentTopicResult, GapReportData } from "@/types/assessment";
export type { AssessmentTopicResult } from "@/types/assessment";
import { CLIENT_DEMO_GAP_REPORT } from "@/lib/demo/client-gap-report";
import type { RevisionPlanOverview, TopicPriorityFactors } from "@/types/planner";
import { rankTopicsByPriority } from "@/lib/algorithms/priority";
import { generateRevisionPlan, updatePlanAfterRetest } from "@/lib/algorithms/scheduler";
import { mergeAssessmentIntoGapReport } from "@/lib/algorithms/gap-report-update";
import { supabase } from "@/lib/supabase/client";

async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `Unexpected server response (${res.status}). Please try again.`,
    };
  }
}

interface WorkspaceContextType {
  profile: ProfileRow;
  workspace: WorkspaceRow;
  isLoggedIn: boolean;
  isDemo: boolean;
  documents: DocumentRow[];
  topics: TopicRow[];
  prerequisites: TopicPrerequisiteRow[];
  gapReport: GapReportData;
  revisionSchedule: RevisionPlanOverview;
  dailyMinutes: number;
  completedTaskIds: string[];
  retestedTopicScores: Record<string, number>;
  storedAssessmentResults: AssessmentTopicResult[];
  loginAsDemo: () => void;
  loginCustom: (email: string, name?: string) => Promise<void>;
  logout: () => void;
  setWorkspaceTopics: (topics: TopicRow[]) => void;
  setWorkspaceDocuments: (docs: DocumentRow[]) => void;
  setWorkspacePrerequisites: (prereqs: TopicPrerequisiteRow[]) => void;
  setDailyMinutes: (mins: number) => void;
  toggleTaskCompletion: (taskId: string) => void;
  triggerRetestTopic: (topicId: string, simulatedScore: number) => void;
  applyAssessmentResults: (results: AssessmentTopicResult[]) => void;
  regenerateSchedule: (minutes: number) => RevisionPlanOverview;
  setRevisionSchedule: React.Dispatch<React.SetStateAction<RevisionPlanOverview>>;
  updateWorkspaceSettings: (settings: { title?: string; examDate?: string | null; dailyStudyMinutes?: number }) => Promise<void>;
  resetToDemo: () => void;
}

/**
 * Deterministically reconstructs topics, gap report, and revision schedule
 * from base demo fixtures plus historical assessment results.
 * Pure function: immune to hydration mismatch and prevents delta duplication on repeated refreshes.
 */
export function reconstructStateFromResults(params: {
  baseTopics: TopicRow[];
  baseGapReport: GapReportData;
  baseSchedule: RevisionPlanOverview;
  results: AssessmentTopicResult[];
  completedTaskIds: string[];
  dailyMinutes?: number;
  prerequisites?: TopicPrerequisiteRow[];
}): {
  nextTopics: TopicRow[];
  nextGapReport: GapReportData;
  nextSchedule: RevisionPlanOverview;
} {
  const { baseTopics, baseGapReport, baseSchedule, results, completedTaskIds, dailyMinutes, prerequisites } = params;
  if (!results || results.length === 0) {
    return { nextTopics: baseTopics, nextGapReport: baseGapReport, nextSchedule: baseSchedule };
  }

  const resultMap = new Map(results.map((r) => [r.topicId, r]));

  const nextTopics = baseTopics.map((t) => {
    const result = resultMap.get(t.id);
    if (!result) return t;
    return {
      ...t,
      current_mastery: result.masteryScore,
      classification: result.classification ?? (result.masteryScore >= 80 ? "strong" : result.masteryScore >= 55 ? "medium" : "weak"),
      evidence_level: result.evidenceLevel ?? t.evidence_level,
      total_attempts: result.totalAttempts ?? ((t.total_attempts || 0) + 1),
      correct_attempts:
        result.correctAttempts ??
        ((result.masteryScore >= 70 ? 1 : 0) + (t.correct_attempts || 0)),
      blind_spot_count: (t.blind_spot_count || 0) + (result.isBlindSpot ? 1 : 0),
    };
  });

  const nextGapReport = mergeAssessmentIntoGapReport(baseGapReport, results);

  const activePrereqs = prerequisites || DEMO_PREREQUISITES;
  const dependentCounts = new Map<string, number>();
  for (const p of activePrereqs) {
    dependentCounts.set(
      p.prerequisite_topic_id,
      (dependentCounts.get(p.prerequisite_topic_id) || 0) + 1
    );
  }

  const prioritized = rankTopicsByPriority(
    nextTopics.map((t) => ({
      topicId: t.id,
      topicTitle: t.title,
      masteryScore: t.current_mastery ?? 45,
      examWeight: t.exam_weight ?? 0,
      blindSpotCount: t.blind_spot_count ?? 0,
      totalAttempts: t.total_attempts ?? 0,
      downstreamDependentsCount: dependentCounts.get(t.id) || 0,
      totalTopicsCount: nextTopics.length,
    }))
  );

  const metadata = new Map(
    nextTopics.map((t) => [
      t.id,
      {
        sourceChunkId: t.source_chunk_id,
        citationReference: t.unit_module ? `${t.unit_module}: ${t.title}` : t.title,
      },
    ])
  );

  const targetMinutes = dailyMinutes ?? baseSchedule.dailyMinutes;
  const withHistory: RevisionPlanOverview = {
    ...baseSchedule,
    dailyMinutes: targetMinutes,
    days: baseSchedule.days.map((day) => ({
      ...day,
      tasks: day.tasks.map((task) =>
        completedTaskIds.includes(task.id) ? { ...task, status: "completed" as const } : task
      ),
    })),
  };

  const nextSchedule = updatePlanAfterRetest({
    existingPlan: withHistory,
    prioritizedTopics: prioritized,
    topicMetadataMap: metadata,
  });

  return { nextTopics, nextGapReport, nextSchedule };
}

function createEmptyGapReport(workspace: WorkspaceRow): GapReportData {
  return {
    workspaceId: workspace.id,
    workspaceTitle: workspace.title,
    examDate: workspace.exam_date,
    daysRemaining: null,
    readiness: {
      readinessScore: 0,
      assessedTopicsCount: 0,
      totalTopicsCount: 0,
      coveragePercentage: 0,
      averageMastery: 0,
      isDataSufficient: false,
      insufficiencyReason:
        "Not enough assessment data. Upload course material and complete a diagnostic to calibrate readiness.",
    },
    blindSpots: {
      totalBlindSpots: 0,
      highRiskTopics: [],
      items: [],
    },
    topics: [],
    urgentActions: [],
    generatedAt: new Date().toISOString(),
  };
}

function createEmptySchedule(workspace: WorkspaceRow): RevisionPlanOverview {
  return {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    version: 1,
    examDate: workspace.exam_date,
    dailyMinutes: workspace.daily_study_minutes,
    totalDays: 0,
    totalAllocatedMinutes: 0,
    totalAvailableMinutes: 0,
    completedMinutes: 0,
    isActive: true,
    days: [],
    deferredTasksCount: 0,
  };
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ProfileRow>(DEMO_PROFILE);
  const [workspace, setWorkspace] = useState<WorkspaceRow>(DEMO_WORKSPACE);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [dailyMinutes, setDailyMinutesState] = useState<number>(60);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [retestedTopicScores, setRetestedTopicScores] = useState<Record<string, number>>({});
  const [storedAssessmentResults, setStoredAssessmentResults] = useState<AssessmentTopicResult[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>(DEMO_DOCUMENTS);
  const [topics, setTopics] = useState<TopicRow[]>(DEMO_TOPICS);
  const [prerequisites, setPrerequisites] = useState<TopicPrerequisiteRow[]>(DEMO_PREREQUISITES);
  const [gapReport, setGapReport] = useState<GapReportData>(CLIENT_DEMO_GAP_REPORT);
  const [revisionSchedule, setRevisionSchedule] = useState<RevisionPlanOverview>(DEMO_REVISION_SCHEDULE);

  // Restore state from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedAuth = localStorage.getItem("gaplens_auth_state");
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          const restoredIsDemo = parsed.isDemo ?? true;
          const restoredWorkspace = parsed.workspace || DEMO_WORKSPACE;
          setIsLoggedIn(parsed.isLoggedIn ?? true);
          setIsDemo(restoredIsDemo);
          if (parsed.profile) setProfile(parsed.profile);
          setWorkspace(restoredWorkspace);

          if (!restoredIsDemo) {
            const restoredDocs: DocumentRow[] = Array.isArray(parsed.documents) ? parsed.documents : [];
            const restoredTopics: TopicRow[] = Array.isArray(parsed.topics) ? parsed.topics : [];
            const restoredPrereqs: TopicPrerequisiteRow[] = Array.isArray(parsed.prerequisites) ? parsed.prerequisites : [];

            setDocuments(restoredDocs);
            setTopics(restoredTopics);
            setPrerequisites(restoredPrereqs);
            if (parsed.gapReport) setGapReport(parsed.gapReport);
            else setGapReport(createEmptyGapReport(restoredWorkspace));

            if (parsed.revisionSchedule) setRevisionSchedule(parsed.revisionSchedule);
            else setRevisionSchedule(createEmptySchedule(restoredWorkspace));

            // Hydrate gap report from server only if it contains non-empty topics
            // (prevents unmigrated/empty server responses from overwriting local progress)
            fetch(`/api/gap-report?workspaceId=${restoredWorkspace.id}`)
              .then((r) => r.json())
              .then((d) => {
                if (d && !d.error && Array.isArray(d.topics) && d.topics.length > 0) {
                  setGapReport(d);
                }
              })
              .catch(() => undefined);

            // Hydrate from live Supabase if credentials and session exist
            supabase
              .from("documents")
              .select("*")
              .eq("workspace_id", restoredWorkspace.id)
              .then(({ data, error }) => {
                if (!error && data && data.length > 0) setDocuments(data as DocumentRow[]);
              });

            supabase
              .from("topics")
              .select("*")
              .eq("workspace_id", restoredWorkspace.id)
              .order("order_index", { ascending: true })
              .then(({ data, error }) => {
                if (!error && data && data.length > 0) setTopics(data as TopicRow[]);
              });

            supabase
              .from("topic_prerequisites")
              .select("*")
              .eq("workspace_id", restoredWorkspace.id)
              .then(({ data, error }) => {
                if (!error && data && data.length > 0) setPrerequisites(data as TopicPrerequisiteRow[]);
              });

            // Hydrate active revision plan & tasks from live Supabase
            supabase
              .from("revision_plans")
              .select("*")
              .eq("workspace_id", restoredWorkspace.id)
              .eq("is_active", true)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(({ data: rawPlanRow, error: planErr }) => {
                const planRow = rawPlanRow as any;
                if (planErr || !planRow) return;
                supabase
                  .from("revision_tasks")
                  .select("*")
                  .eq("plan_id", planRow.id)
                  .order("day_number", { ascending: true })
                  .order("task_order", { ascending: true })
                  .then(({ data: rawTaskRows, error: taskErr }) => {
                    const taskRows = rawTaskRows as any[] | null;
                    if (taskErr || !taskRows) return;
                    const dayMap = new Map<number, any[]>();
                    const completedIds: string[] = [];
                    let completedMinutes = 0;

                    for (const t of taskRows) {
                      if (t.status === "completed") {
                        completedIds.push(t.id);
                        completedMinutes += t.allocated_minutes || 0;
                      }
                      const list = dayMap.get(t.day_number) || [];
                      list.push({
                        id: t.id,
                        planId: t.plan_id,
                        topicId: t.topic_id,
                        topicTitle: (t.title || "").includes(": ")
                          ? (t.title || "").slice((t.title || "").indexOf(": ") + 2).trim()
                          : t.title,
                        dayNumber: t.day_number,
                        taskOrder: t.task_order,
                        taskType: t.task_type,
                        title: t.title,
                        description: t.description || "",
                        allocatedMinutes: t.allocated_minutes,
                        priorityScore: t.priority_score,
                        status: t.status,
                        sourceChunkId: t.source_chunk_id,
                        citationReference: t.citation_reference,
                        completedAt: t.completed_at,
                      });
                      dayMap.set(t.day_number, list);
                    }

                    const days = Array.from(dayMap.entries())
                      .sort((a, b) => a[0] - b[0])
                      .map(([dayNumber, dayTasks]) => ({
                        dayNumber,
                        date: "",
                        availableMinutes: planRow.daily_minutes,
                        allocatedMinutes: dayTasks.reduce((s, dt) => s + (dt.allocatedMinutes || 0), 0),
                        tasks: dayTasks,
                      }));

                    if (days.length > 0) {
                      setRevisionSchedule({
                        id: planRow.id,
                        workspaceId: planRow.workspace_id,
                        version: planRow.version,
                        examDate: planRow.exam_date,
                        dailyMinutes: planRow.daily_minutes,
                        totalDays: planRow.total_days,
                        totalAllocatedMinutes: planRow.total_allocated_minutes,
                        totalAvailableMinutes: planRow.total_days * planRow.daily_minutes,
                        completedMinutes,
                        isActive: planRow.is_active,
                        days,
                        deferredTasksCount: 0,
                      });
                      setDailyMinutesState(planRow.daily_minutes);
                      if (completedIds.length > 0) setCompletedTaskIds(completedIds);
                    }
                  });
              });
          }

          if (parsed.dailyMinutes) setDailyMinutesState(parsed.dailyMinutes);
          const restoredTasks: string[] = Array.isArray(parsed.completedTasks) ? parsed.completedTasks : [];
          setCompletedTaskIds(restoredTasks);

          if (parsed.retestedTopicScores && typeof parsed.retestedTopicScores === "object") {
            setRetestedTopicScores(parsed.retestedTopicScores);
          }

          let resultsToApply: AssessmentTopicResult[] = Array.isArray(parsed.storedAssessmentResults)
            ? parsed.storedAssessmentResults
            : [];

          if (resultsToApply.length === 0 && parsed.retestedTopicScores && typeof parsed.retestedTopicScores === "object") {
            resultsToApply = Object.entries(parsed.retestedTopicScores).map(([topicId, score]) => {
              const numScore = typeof score === "number" ? score : Number(score);
              return {
                topicId,
                masteryScore: numScore,
                classification: numScore >= 80 ? "strong" : numScore >= 55 ? "medium" : "weak",
              };
            });
          }

          if (restoredIsDemo && resultsToApply.length > 0) {
            const restored = reconstructStateFromResults({
              baseTopics: DEMO_TOPICS,
              baseGapReport: CLIENT_DEMO_GAP_REPORT,
              baseSchedule: DEMO_REVISION_SCHEDULE,
              results: resultsToApply,
              completedTaskIds: restoredTasks,
              dailyMinutes: parsed.dailyMinutes,
              prerequisites: DEMO_PREREQUISITES,
            });
            setTopics(restored.nextTopics);
            setGapReport(restored.nextGapReport);
            setRevisionSchedule(restored.nextSchedule);
          }

          if (resultsToApply.length > 0) {
            setStoredAssessmentResults(resultsToApply);
          }
        }
      } catch {
        // Fallback to default demo
      }
    }
  }, []);

  // Save changes to localStorage
  const saveState = (updates: Partial<{
    isLoggedIn: boolean;
    isDemo: boolean;
    profile: ProfileRow;
    workspace: WorkspaceRow;
    dailyMinutes: number;
    completedTasks: string[];
    retestedTopicScores: Record<string, number>;
    storedAssessmentResults: AssessmentTopicResult[];
    documents: DocumentRow[];
    topics: TopicRow[];
    prerequisites: TopicPrerequisiteRow[];
    gapReport: GapReportData;
    revisionSchedule: RevisionPlanOverview;
  }>) => {
    if (typeof window !== "undefined") {
      try {
        const current = {
          isLoggedIn,
          isDemo,
          profile,
          workspace,
          dailyMinutes,
          completedTasks: completedTaskIds,
          retestedTopicScores,
          storedAssessmentResults,
          documents: isDemo ? [] : documents,
          topics: isDemo ? [] : topics,
          prerequisites: isDemo ? [] : prerequisites,
          gapReport: isDemo ? undefined : gapReport,
          revisionSchedule: isDemo ? undefined : revisionSchedule,
          ...updates,
        };
        try {
          localStorage.setItem("gaplens_auth_state", JSON.stringify(current));
        } catch {
          // QuotaExceededError fallback: strip bulky extracted_text from documents so mastery/progress still persist
          const compactDocs = Array.isArray(current.documents)
            ? current.documents.map((d: any) => {
                const { extracted_text: _omitted, ...rest } = d || {};
                return rest;
              })
            : [];
          localStorage.setItem(
            "gaplens_auth_state",
            JSON.stringify({ ...current, documents: compactDocs })
          );
        }
      } catch {
        // Ignore storage errors
      }
    }
  };

  const loginAsDemo = () => {
    if (typeof document !== "undefined") {
      document.cookie = "gaplens_demo_session=true; path=/; max-age=86400; SameSite=Lax";
    }
    setProfile(DEMO_PROFILE);
    setWorkspace(DEMO_WORKSPACE);
    setIsLoggedIn(true);
    setIsDemo(true);
    setDailyMinutesState(60);
    setCompletedTaskIds([]);
    setRetestedTopicScores({});
    setStoredAssessmentResults([]);
    setDocuments(DEMO_DOCUMENTS);
    setTopics(DEMO_TOPICS);
    setPrerequisites(DEMO_PREREQUISITES);
    setGapReport(CLIENT_DEMO_GAP_REPORT);
    setRevisionSchedule(DEMO_REVISION_SCHEDULE);
    saveState({
      isLoggedIn: true,
      isDemo: true,
      profile: DEMO_PROFILE,
      workspace: DEMO_WORKSPACE,
      dailyMinutes: 60,
      completedTasks: [],
      retestedTopicScores: {},
      storedAssessmentResults: [],
      documents: [],
      topics: [],
      prerequisites: [],
    });
  };

  const loginCustom = async (email: string, name?: string) => {
    let user: { id: string; email?: string } | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      user = null;
    }

    if (!user) {
      throw new Error(
        "Unable to establish authenticated user session. Please ensure Supabase is configured with valid credentials, or use the 1-click Demo workspace."
      );
    }

    // Call atomic server-side provisioning route
    const res = await fetch("/api/auth/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: name || email.split("@")[0] }),
    });

    const provisionData = await parseJsonResponse(res);
    if (!res.ok || !provisionData.success) {
      throw new Error(provisionData.error || "Failed to provision workspace");
    }

    const customProfile: ProfileRow = provisionData.profile;
    const customWorkspace: WorkspaceRow = provisionData.workspace;
    const initialDocs: DocumentRow[] = provisionData.documents || [];
    const initialTopics: TopicRow[] = provisionData.topics || [];
    const initialPrereqs: TopicPrerequisiteRow[] = provisionData.prerequisites || [];

    const emptyReport = createEmptyGapReport(customWorkspace);
    const emptySchedule = createEmptySchedule(customWorkspace);

    setProfile(customProfile);
    setWorkspace(customWorkspace);
    setIsLoggedIn(true);
    setIsDemo(false);
    setCompletedTaskIds([]);
    setRetestedTopicScores({});
    setStoredAssessmentResults([]);
    setDocuments(initialDocs);
    setTopics(initialTopics);
    setPrerequisites(initialPrereqs);
    setGapReport(emptyReport);
    setRevisionSchedule(emptySchedule);

    saveState({
      isLoggedIn: true,
      isDemo: false,
      profile: customProfile,
      workspace: customWorkspace,
      dailyMinutes: customWorkspace.daily_study_minutes,
      completedTasks: [],
      retestedTopicScores: {},
      storedAssessmentResults: [],
      documents: initialDocs,
      topics: initialTopics,
      prerequisites: initialPrereqs,
      gapReport: emptyReport,
      revisionSchedule: emptySchedule,
    });
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors
    }
    if (typeof document !== "undefined") {
      document.cookie = "gaplens_demo_session=; path=/; max-age=0; SameSite=Lax";
    }
    setIsLoggedIn(false);
    saveState({ isLoggedIn: false, isDemo: false });
  };

  const setDailyMinutes = (mins: number) => {
    const clamped = Math.max(15, Math.min(1440, mins));
    setDailyMinutesState(clamped);
    saveState({ dailyMinutes: clamped });
  };

  const updateWorkspaceSettings = async (settings: {
    title?: string;
    examDate?: string | null;
    dailyStudyMinutes?: number;
  }) => {
    const updated: WorkspaceRow = {
      ...workspace,
      title: settings.title ?? workspace.title,
      exam_date: settings.examDate !== undefined ? settings.examDate : workspace.exam_date,
      daily_study_minutes: settings.dailyStudyMinutes ?? workspace.daily_study_minutes,
      updated_at: new Date().toISOString(),
    };
    setWorkspace(updated);
    if (settings.dailyStudyMinutes) {
      setDailyMinutesState(settings.dailyStudyMinutes);
    }
    saveState({ workspace: updated, dailyMinutes: updated.daily_study_minutes });

    if (!isDemo && workspace?.id) {
      try {
        await fetch(`/api/workspaces/${workspace.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: settings.title,
            examDate: settings.examDate,
            dailyStudyMinutes: settings.dailyStudyMinutes,
          }),
        });
      } catch (err) {
        console.warn("[WorkspaceContext] Failed to persist workspace settings:", err);
      }
    }
  };

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const exists = prev.includes(taskId);
      const nextStatus = exists ? "pending" : "completed";
      const next = exists ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      saveState({ completedTasks: next });

      if (!isDemo && workspace?.id) {
        fetch("/api/planner/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: workspace.id,
            taskId,
            status: nextStatus,
            completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
          }),
        }).catch(() => undefined);
      }
      return next;
    });
  };

  const buildPriorities = (nextTopics: TopicRow[]): TopicPriorityFactors[] => {
    const dependentCounts = new Map<string, number>();
    const activePrereqs = isDemo ? DEMO_PREREQUISITES : prerequisites;
    for (const p of activePrereqs) {
      dependentCounts.set(
        p.prerequisite_topic_id,
        (dependentCounts.get(p.prerequisite_topic_id) || 0) + 1
      );
    }

    return rankTopicsByPriority(
      nextTopics.map((t) => ({
        topicId: t.id,
        topicTitle: t.title,
        masteryScore: t.current_mastery ?? 45,
        examWeight: t.exam_weight ?? 0,
        blindSpotCount: t.blind_spot_count ?? 0,
        totalAttempts: t.total_attempts ?? 0,
        downstreamDependentsCount: dependentCounts.get(t.id) || 0,
        totalTopicsCount: nextTopics.length,
      }))
    );
  };

  const buildMetadata = (nextTopics: TopicRow[]) =>
    new Map(
      nextTopics.map((t) => [
        t.id,
        {
          sourceChunkId: t.source_chunk_id,
          citationReference: t.unit_module ? `${t.unit_module}: ${t.title}` : t.title,
        },
      ])
    );

  const withCompletionHistory = (plan: RevisionPlanOverview): RevisionPlanOverview => ({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      tasks: day.tasks.map((task) =>
        completedTaskIds.includes(task.id) ? { ...task, status: "completed" as const } : task
      ),
    })),
  });

  const regenerateSchedule = (minutes: number): RevisionPlanOverview => {
    const nextMinutes = Math.max(15, Math.min(1440, minutes));
    const nextPlan = generateRevisionPlan({
      planId: revisionSchedule.id,
      workspaceId: revisionSchedule.workspaceId,
      version: revisionSchedule.version + 1,
      prioritizedTopics: buildPriorities(topics),
      dailyMinutes: nextMinutes,
      daysRemaining: revisionSchedule.totalDays,
      examDate: revisionSchedule.examDate,
      existingTasks: withCompletionHistory(revisionSchedule).days.flatMap((d) => d.tasks),
      topicMetadataMap: buildMetadata(topics),
    });
    setRevisionSchedule(nextPlan);
    return nextPlan;
  };

  const setWorkspaceTopics = (newTopics: TopicRow[]) => {
    setTopics(newTopics);
    saveState({ topics: newTopics });
    setGapReport((prev) => ({
      ...prev,
      topics: newTopics.map((t) => ({
        topicId: t.id,
        topicTitle: t.title,
        unitModule: t.unit_module || null,
        masteryScore: t.current_mastery ?? 45.0,
        classification: t.classification || "unassessed",
        evidenceLevel: t.evidence_level || "early_signal",
        totalAttempts: t.total_attempts ?? 0,
        correctAttempts: t.correct_attempts ?? 0,
        blindSpotCount: t.blind_spot_count ?? 0,
        examWeight: t.exam_weight ?? 0.0,
        examFrequency: t.exam_frequency ?? 0,
        lastAttemptAt: null,
      })),
      readiness: {
        ...prev.readiness,
        totalTopicsCount: newTopics.length,
      },
    }));
  };

  const setWorkspaceDocuments = (newDocs: DocumentRow[]) => {
    setDocuments(newDocs);
    saveState({ documents: newDocs });
  };

  const setWorkspacePrerequisites = (newPrereqs: TopicPrerequisiteRow[]) => {
    setPrerequisites(newPrereqs);
    saveState({ prerequisites: newPrereqs });
  };

  const applyAssessmentResults = (results: AssessmentTopicResult[]) => {
    if (results.length === 0) return;

    // Merge incoming results with previously recorded results
    const combinedResultsMap = new Map<string, AssessmentTopicResult>();
    for (const r of storedAssessmentResults) combinedResultsMap.set(r.topicId, r);
    for (const r of results) combinedResultsMap.set(r.topicId, r);
    const combinedResults = Array.from(combinedResultsMap.values());

    const updated = reconstructStateFromResults({
      baseTopics: isDemo ? DEMO_TOPICS : topics,
      baseGapReport: isDemo ? CLIENT_DEMO_GAP_REPORT : gapReport,
      baseSchedule: isDemo ? DEMO_REVISION_SCHEDULE : revisionSchedule,
      results: combinedResults,
      completedTaskIds,
      dailyMinutes,
      prerequisites: isDemo ? DEMO_PREREQUISITES : prerequisites,
    });

    setTopics(updated.nextTopics);
    setGapReport(updated.nextGapReport);
    setRevisionSchedule(updated.nextSchedule);
    setStoredAssessmentResults(combinedResults);

    const nextScores = { ...retestedTopicScores };
    for (const r of results) nextScores[r.topicId] = r.masteryScore;
    setRetestedTopicScores(nextScores);

    saveState({
      retestedTopicScores: nextScores,
      storedAssessmentResults: combinedResults,
    });
  };

  const triggerRetestTopic = (topicId: string, simulatedScore: number) => {
    applyAssessmentResults([
      {
        topicId,
        masteryScore: simulatedScore,
        classification: simulatedScore >= 80 ? "strong" : simulatedScore >= 55 ? "medium" : "weak",
      },
    ]);
  };

  const resetToDemo = () => {
    loginAsDemo();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        profile,
        workspace,
        isLoggedIn,
        isDemo,
        documents,
        topics,
        prerequisites,
        gapReport,
        revisionSchedule,
        dailyMinutes,
        completedTaskIds,
        retestedTopicScores,
        storedAssessmentResults,
        loginAsDemo,
        loginCustom,
        logout,
        setWorkspaceTopics,
        setWorkspaceDocuments,
        setWorkspacePrerequisites,
        setDailyMinutes,
        toggleTaskCompletion,
        triggerRetestTopic,
        applyAssessmentResults,
        regenerateSchedule,
        setRevisionSchedule,
        updateWorkspaceSettings,
        resetToDemo,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
