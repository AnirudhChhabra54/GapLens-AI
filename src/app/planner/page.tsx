"use client";

// ==============================================================================
// GapLens AI — Screen 6: Revision Planner & Grounded Copilot
// Time-budgeted daily schedule, completion history, citation-linked tasks, and
// a source-locked Copilot drawer for micro-learning.
// ==============================================================================

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BookOpen,
  MessageSquareCode,
  ShieldCheck,
  Timer,
  Layers,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CopilotDrawer } from "@/components/copilot-drawer";
import { cn } from "@/lib/utils";

const TASK_TYPE_LABELS: Record<string, string> = {
  read_source: "Read source",
  copilot_lesson: "Copilot lesson",
  practice_drill: "Practice drill",
  retest: "Retest",
  spaced_review: "Spaced review",
};

const TASK_TYPE_STYLES: Record<string, string> = {
  read_source: "border-sky-800 bg-sky-950/40 text-sky-300",
  copilot_lesson: "border-violet-800 bg-violet-950/40 text-violet-300",
  practice_drill: "border-amber-800 bg-amber-950/40 text-amber-300",
  retest: "border-rose-800 bg-rose-950/40 text-rose-300",
  spaced_review: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
};

export default function PlannerPage() {
  const {
    workspace,
    topics,
    gapReport,
    revisionSchedule,
    dailyMinutes,
    completedTaskIds,
    toggleTaskCompletion,
    setDailyMinutes,
    regenerateSchedule,
  } = useWorkspace();

  const [copilotOpen, setCopilotOpen] = useState(false);
  const [activeTopicTitle, setActiveTopicTitle] = useState(
    gapReport.blindSpots.highRiskTopics[0]?.topicTitle ||
      topics.find((t) => t.classification === "weak")?.title ||
      topics[0]?.title ||
      "Operating Systems"
  );

  const plan = revisionSchedule;
  const totalTasks = plan.days.reduce((sum, d) => sum + d.tasks.length, 0);
  const effectiveCompleted = useMemo(() => {
    let count = 0;
    for (const day of plan.days) {
      for (const task of day.tasks) {
        if (task.status === "completed" || completedTaskIds.includes(task.id)) count++;
      }
    }
    return count;
  }, [plan, completedTaskIds]);

  const pendingCount = totalTasks - effectiveCompleted;
  const utilization =
    plan.totalAvailableMinutes > 0
      ? Math.min(100, (plan.totalAllocatedMinutes / plan.totalAvailableMinutes) * 100)
      : 0;

  const onBudgetChange = (value: number) => {
    setDailyMinutes(value);
    regenerateSchedule(value);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-7 bg-[#0B0F19] text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            <span>SCREEN 6 • REVISION PLANNER & COPILOT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Plan That Fits Your Real Week</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {workspace?.title} · {plan.totalDays} days · daily work never exceeds the chosen budget.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCopilotOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20"
        >
          <MessageSquareCode className="h-4 w-4" />
          Ask Study Copilot
        </button>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Daily Budget</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-black font-mono text-cyan-300">{dailyMinutes}</span>
            <span className="text-xs text-slate-400">minutes</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Scheduled</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">{plan.totalAllocatedMinutes}</span>
            <span className="text-xs text-slate-400">/ {plan.totalAvailableMinutes} min</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Tasks</span>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">{pendingCount}</span>
            <span className="text-xs text-slate-400">pending · {effectiveCompleted} done</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Deferred</span>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("text-2xl font-black font-mono", plan.deferredTasksCount > 0 ? "text-amber-300" : "text-slate-100")}>
              {plan.deferredTasksCount}
            </span>
            <span className="text-xs text-slate-400">tasks did not fit</span>
          </div>
        </div>
      </div>

      {/* Budget control + constraint */}
      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Timer className="h-4 w-4 text-cyan-400" />
              Daily Study Time
            </div>
            <span className="rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-2.5 py-1 font-mono text-xs text-cyan-300">
              {dailyMinutes} min/day
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={180}
            step={15}
            value={dailyMinutes}
            onChange={(e) => onBudgetChange(Number(e.target.value))}
            className="mt-4 w-full accent-cyan-500"
            aria-label="Daily study minutes"
          />
          <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-500">
            <span>15</span>
            <span>30</span>
            <span>60</span>
            <span>90</span>
            <span>120</span>
            <span>180</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[15, 30, 45, 60, 90, 120].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onBudgetChange(preset)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition",
                  dailyMinutes === preset
                    ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-300"
                    : "border-slate-800 bg-slate-950 text-slate-400"
                )}
              >
                {preset} min
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Hard Scheduling Invariants
          </div>
          <ul className="mt-3 space-y-2 text-[11px] text-slate-400">
            <li className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Daily scheduled minutes can never exceed the budget.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Every task has a positive duration and a valid topic or source.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Completed history is preserved; only pending work is reordered.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Deferred work is shown explicitly, never silently dropped.
            </li>
          </ul>
          <div className="mt-3 border-t border-emerald-900/40 pt-3 text-[10px] text-slate-500">
            Budget utilization: {utilization.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Schedule */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Daily Revision Queue</h2>
            <p className="text-xs text-slate-400">
              Ordered by mastery deficit, exam weight, blind-spot risk, and prerequisite impact.
            </p>
          </div>
          <Link href="/gap-report" className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
            Evidence behind the order <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {plan.days.map((day) => {
            const done = day.tasks.filter(
              (t) => t.status === "completed" || completedTaskIds.includes(t.id)
            ).length;
            const budgetPct = Math.min(
              100,
              day.availableMinutes > 0 ? (day.allocatedMinutes / day.availableMinutes) * 100 : 0
            );

            return (
              <div key={day.dayNumber} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-800/60 bg-cyan-950/50 font-mono text-[11px] font-bold text-cyan-300">
                      D{day.dayNumber}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-100">{day.date}</p>
                      <p className="text-[10px] text-slate-500">
                        {day.tasks.length} tasks · {done} completed
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {day.allocatedMinutes}/{day.availableMinutes} min
                  </span>
                </div>

                <div className="h-1 bg-slate-950">
                  <div
                    className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>

                <div className="divide-y divide-slate-800/80">
                  {day.tasks.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[11px] text-slate-500">
                      No tasks scheduled. Increase the daily budget or add revision work.
                    </div>
                  ) : (
                    day.tasks.map((task) => {
                      const isDone =
                        task.status === "completed" || completedTaskIds.includes(task.id);
                      return (
                        <div key={task.id} className="p-4 hover:bg-slate-900/40 transition">
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleTaskCompletion(task.id)}
                              aria-label={isDone ? "Mark task pending" : "Mark task completed"}
                              className="mt-0.5"
                            >
                              {isDone ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-600 hover:text-cyan-400" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                    TASK_TYPE_STYLES[task.taskType] ||
                                      "border-slate-700 bg-slate-950 text-slate-400"
                                  )}
                                >
                                  {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                                </span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {task.allocatedMinutes} min
                                </span>
                                <span className="font-mono text-[10px] text-cyan-400/80">
                                  P{task.priorityScore.toFixed(0)}
                                </span>
                              </div>
                              <p
                                className={cn(
                                  "mt-1 text-xs font-semibold",
                                  isDone ? "text-slate-500 line-through" : "text-slate-100"
                                )}
                              >
                                {task.title}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                                {task.description}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {task.citationReference && (
                                  <span className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-400">
                                    <BookOpen className="h-3 w-3 text-cyan-400" />
                                    {task.citationReference}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTopicTitle(task.topicTitle);
                                    setCopilotOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-violet-800/60 bg-violet-950/30 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300"
                                >
                                  <Sparkles className="h-3 w-3" /> Explain with Copilot
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {plan.deferredTasksCount > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-800/70 bg-amber-950/20 p-3.5 text-[11px] text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {plan.deferredTasksCount} candidate task{plan.deferredTasksCount === 1 ? "" : "s"} did not fit
              in the current time budget. Increase daily minutes, extend the plan horizon, or accept that
              lower-priority work is deferred.
            </span>
          </div>
        )}
      </section>

      {/* Weak topics shortcut */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
          <Layers className="h-4 w-4 text-cyan-400" />
          Weak-Topic Retests
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {topics
            .filter((t) => t.classification === "weak")
            .map((t) => (
              <Link
                key={t.id}
                href="/diagnostic"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-800/60 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-950/50"
              >
                <Clock className="h-3 w-3" /> Retest: {t.title}
              </Link>
            ))}
          {topics.filter((t) => t.classification === "weak").length === 0 && (
            <span className="text-[11px] text-slate-500">No weak topics in the current evidence.</span>
          )}
        </div>
      </section>

      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        activeTopicTitle={activeTopicTitle}
      />
    </div>
  );
}
