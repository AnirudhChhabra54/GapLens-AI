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

interface WorkspaceContextType {
  profile: ProfileRow;
  workspace: WorkspaceRow;
  isLoggedIn: boolean;
  isDemo: boolean;
  documents: DocumentRow[];
  topics: TopicRow[];
  gapReport: GapReportData;
  revisionSchedule: RevisionPlanOverview;
  dailyMinutes: number;
  completedTaskIds: string[];
  retestedTopicScores: Record<string, number>;
  storedAssessmentResults: AssessmentTopicResult[];
  loginAsDemo: () => void;
  loginCustom: (email: string, name?: string) => void;
  logout: () => void;
  setDailyMinutes: (mins: number) => void;
  toggleTaskCompletion: (taskId: string) => void;
  triggerRetestTopic: (topicId: string, simulatedScore: number) => void;
  applyAssessmentResults: (results: AssessmentTopicResult[]) => void;
  regenerateSchedule: (minutes: number) => RevisionPlanOverview;
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
}): {
  nextTopics: TopicRow[];
  nextGapReport: GapReportData;
  nextSchedule: RevisionPlanOverview;
} {
  const { baseTopics, baseGapReport, baseSchedule, results, completedTaskIds, dailyMinutes } = params;
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

  const dependentCounts = new Map<string, number>();
  for (const p of DEMO_PREREQUISITES) {
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
  const [gapReport, setGapReport] = useState<GapReportData>(CLIENT_DEMO_GAP_REPORT);
  const [revisionSchedule, setRevisionSchedule] = useState<RevisionPlanOverview>(DEMO_REVISION_SCHEDULE);

  // Restore state from localStorage if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const storedAuth = localStorage.getItem("gaplens_auth_state");
        if (storedAuth) {
          const parsed = JSON.parse(storedAuth);
          setIsLoggedIn(parsed.isLoggedIn ?? true);
          setIsDemo(parsed.isDemo ?? true);
          if (parsed.profile) setProfile(parsed.profile);
          if (parsed.workspace) setWorkspace(parsed.workspace);
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

          if (resultsToApply.length > 0) {
            const restored = reconstructStateFromResults({
              baseTopics: DEMO_TOPICS,
              baseGapReport: CLIENT_DEMO_GAP_REPORT,
              baseSchedule: DEMO_REVISION_SCHEDULE,
              results: resultsToApply,
              completedTaskIds: restoredTasks,
              dailyMinutes: parsed.dailyMinutes,
            });
            setTopics(restored.nextTopics);
            setGapReport(restored.nextGapReport);
            setRevisionSchedule(restored.nextSchedule);
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
          ...updates,
        };
        localStorage.setItem("gaplens_auth_state", JSON.stringify(current));
      } catch {
        // Ignore storage errors
      }
    }
  };

  const loginAsDemo = () => {
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
    });
  };

  const loginCustom = (email: string, name?: string) => {
    const customProfile: ProfileRow = {
      id: "custom-" + Date.now(),
      email,
      full_name: name || email.split("@")[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const customWorkspace: WorkspaceRow = {
      id: "ws-" + Date.now(),
      user_id: customProfile.id,
      title: "My Course Workspace",
      description: "Custom revision workspace",
      exam_date: "2026-12-15",
      daily_study_minutes: 60,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setProfile(customProfile);
    setWorkspace(customWorkspace);
    setIsLoggedIn(true);
    setIsDemo(false);
    saveState({
      isLoggedIn: true,
      isDemo: false,
      profile: customProfile,
      workspace: customWorkspace,
    });
  };

  const logout = () => {
    setIsLoggedIn(false);
    saveState({ isLoggedIn: false });
  };

  const setDailyMinutes = (mins: number) => {
    const clamped = Math.max(15, Math.min(180, mins));
    setDailyMinutesState(clamped);
    saveState({ dailyMinutes: clamped });
  };

  const toggleTaskCompletion = (taskId: string) => {
    setCompletedTaskIds((prev) => {
      const exists = prev.includes(taskId);
      const next = exists ? prev.filter((id) => id !== taskId) : [...prev, taskId];
      saveState({ completedTasks: next });
      return next;
    });
  };

  const buildPriorities = (nextTopics: TopicRow[]): TopicPriorityFactors[] => {
    const dependentCounts = new Map<string, number>();
    for (const p of DEMO_PREREQUISITES) {
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
    const nextMinutes = Math.max(15, Math.min(180, minutes));
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

  const applyAssessmentResults = (results: AssessmentTopicResult[]) => {
    if (results.length === 0) return;

    // Merge incoming results with previously recorded results
    const combinedResultsMap = new Map<string, AssessmentTopicResult>();
    for (const r of storedAssessmentResults) combinedResultsMap.set(r.topicId, r);
    for (const r of results) combinedResultsMap.set(r.topicId, r);
    const combinedResults = Array.from(combinedResultsMap.values());

    const updated = reconstructStateFromResults({
      baseTopics: DEMO_TOPICS,
      baseGapReport: CLIENT_DEMO_GAP_REPORT,
      baseSchedule: DEMO_REVISION_SCHEDULE,
      results: combinedResults,
      completedTaskIds,
      dailyMinutes,
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
        gapReport,
        revisionSchedule,
        dailyMinutes,
        completedTaskIds,
        retestedTopicScores,
        storedAssessmentResults,
        loginAsDemo,
        loginCustom,
        logout,
        setDailyMinutes,
        toggleTaskCompletion,
        triggerRetestTopic,
        applyAssessmentResults,
        regenerateSchedule,
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
