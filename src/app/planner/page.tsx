"use client";

// ==============================================================================
// GapLens AI — Screen 6: Revision Planner & Grounded Copilot
// File: src/app/planner/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and knapsack optimization controls.
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
  ChevronRight,
  Zap,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CopilotDrawer } from "@/components/copilot-drawer";
import { cn } from "@/lib/utils";

const TASK_TYPE_LABELS: Record<string, string> = {
  read_source: "Read Source",
  copilot_lesson: "Copilot Lesson",
  practice_drill: "Practice Drill",
  retest: "Topic Retest",
  spaced_review: "Spaced Review",
};

const TASK_TYPE_STYLES: Record<string, string> = {
  read_source: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  copilot_lesson: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  practice_drill: "border-[#00D6A0]/40 bg-[#00D6A0]/10 text-[#00D6A0]",
  retest: "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]",
  spaced_review: "border-[#B7FFE8]/30 bg-[#B7FFE8]/10 text-[#B7FFE8]",
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
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-[#00D6A0]/[0.035] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#B7FFE8]/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
              <span>[ SYSTEM 06 / ADAPTIVE REVISION PLANNER ]</span>
              <span className="text-[#6D7C74]">•</span>
              <span className="text-[#A0ADA6]">KNAPSACK PACKING</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
              Plan That Fits Your Real Week
            </h1>
            <p className="text-sm text-[#A0ADA6] max-w-2xl">
              {workspace?.title} • {plan.totalDays} days horizon. Micro-learning tasks packed dynamically so daily workload never exceeds your available time.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#00D6A0] hover:bg-[#00D6A0]/90 text-[#080D0C] px-5 py-2.5 text-xs font-mono font-bold shadow-lg shadow-[#00D6A0]/20 transition shrink-0"
          >
            <MessageSquareCode className="h-4 w-4" />
            <span>Launch Study Copilot</span>
          </button>
        </div>

        {/* Telemetry Summary (4 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-4 sm:p-5 shadow-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0ADA6]">
              Daily Budget
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-[#00D6A0]">{dailyMinutes}</span>
              <span className="text-xs font-mono text-[#A0ADA6]">min / day</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-4 sm:p-5 shadow-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0ADA6]">
              Allocated Time
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-[#F1F7F4]">
                {plan.totalAllocatedMinutes}
              </span>
              <span className="text-xs font-mono text-[#A0ADA6]">/ {plan.totalAvailableMinutes} min</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-4 sm:p-5 shadow-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0ADA6]">
              Active Tasks
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-mono text-[#F1F7F4]">{pendingCount}</span>
              <span className="text-xs font-mono text-[#A0ADA6]">({effectiveCompleted} done)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-4 sm:p-5 shadow-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A0ADA6]">
              Deferred Work
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-3xl font-extrabold font-mono",
                  plan.deferredTasksCount > 0 ? "text-[#FBBF24]" : "text-[#F1F7F4]"
                )}
              >
                {plan.deferredTasksCount}
              </span>
              <span className="text-xs font-mono text-[#A0ADA6]">did not fit budget</span>
            </div>
          </div>
        </div>

        {/* Budget control & Scheduling invariants */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-5">
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#F1F7F4]">
                <Timer className="h-4 w-4 text-[#00D6A0]" />
                <span>Adjust Daily Available Minutes</span>
              </div>
              <span className="rounded-lg border border-[#00D6A0]/30 bg-[#00D6A0]/10 px-3 py-1 font-mono text-xs text-[#00D6A0] font-bold">
                {dailyMinutes} min / day
              </span>
            </div>

            <input
              type="range"
              min={15}
              max={180}
              step={15}
              value={dailyMinutes}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="w-full accent-[#00D6A0] cursor-pointer"
              aria-label="Daily study minutes"
            />

            <div className="flex justify-between text-[10px] font-mono text-[#6D7C74]">
              <span>15m</span>
              <span>30m</span>
              <span>60m</span>
              <span>90m</span>
              <span>120m</span>
              <span>180m</span>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onBudgetChange(preset)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-mono transition-all",
                    dailyMinutes === preset
                      ? "border-[#00D6A0] bg-[#00D6A0]/15 text-[#00D6A0] font-bold"
                      : "border-[#B7FFE8]/[0.08] bg-[#121D18] text-[#A0ADA6] hover:text-[#F1F7F4]"
                  )}
                >
                  {preset} min
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#00D6A0]/25 bg-[#0D1512]/90 p-6 shadow-xl space-y-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#00D6A0]">
                <ShieldCheck className="h-4 w-4" />
                <span>Knapsack Invariants</span>
              </div>
              <ul className="mt-3.5 space-y-2.5 text-[11px] text-[#A0ADA6]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00D6A0] mt-0.5" />
                  <span>Strict Knapsack: Daily tasks can never exceed your set budget.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00D6A0] mt-0.5" />
                  <span>Priority scores reflect mastery deficit, exam weight, and prerequisite edges.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#00D6A0] mt-0.5" />
                  <span>Completed tasks remain immutable; re-planning only mutates pending work.</span>
                </li>
              </ul>
            </div>
            <div className="border-t border-[#B7FFE8]/[0.06] pt-3 text-[11px] font-mono text-[#6D7C74] flex justify-between">
              <span>Budget Utilization</span>
              <span className="text-[#00D6A0]">{utilization.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#B7FFE8]/[0.08]">
            <div>
              <h2 className="text-lg font-bold text-[#F1F7F4]">Daily Revision Queue</h2>
              <p className="text-xs text-[#A0ADA6] mt-0.5">
                Priority-ranked micro-learning sessions optimized for maximum mastery recovery.
              </p>
            </div>
            <Link
              href="/gap-report"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00D6A0] hover:text-[#B7FFE8] transition"
            >
              <span>Inspect Gap Report</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {plan.days.map((day) => {
              const done = day.tasks.filter(
                (t) => t.status === "completed" || completedTaskIds.includes(t.id)
              ).length;
              const budgetPct = Math.min(
                100,
                day.availableMinutes > 0 ? (day.allocatedMinutes / day.availableMinutes) * 100 : 0
              );

              return (
                <div
                  key={day.dayNumber}
                  className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 overflow-hidden shadow-xl"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#B7FFE8]/[0.06] bg-[#080D0C]/80 px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#00D6A0]/40 bg-[#00D6A0]/10 font-mono text-xs font-bold text-[#00D6A0]">
                        D{day.dayNumber}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-[#F1F7F4]">{day.date}</p>
                        <p className="text-[11px] text-[#A0ADA6]">
                          {day.tasks.length} tasks • {done} completed
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[#00D6A0] font-bold">
                      {day.allocatedMinutes} / {day.availableMinutes} min
                    </span>
                  </div>

                  <div className="h-1 bg-[#080D0C]">
                    <div
                      className="h-1 bg-gradient-to-r from-[#00D6A0] to-[#B7FFE8]"
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>

                  <div className="divide-y divide-[#B7FFE8]/[0.04]">
                    {day.tasks.length === 0 ? (
                      <div className="px-5 py-8 text-center text-xs text-[#6D7C74] font-mono">
                        No tasks scheduled. Increase daily budget to include more revision sessions.
                      </div>
                    ) : (
                      day.tasks.map((task) => {
                        const isDone =
                          task.status === "completed" || completedTaskIds.includes(task.id);
                        return (
                          <div
                            key={task.id}
                            className={`p-4 transition-all duration-200 ${
                              isDone ? "bg-[#080D0C]/40 opacity-55" : "hover:bg-[#121D18]/70"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <button
                                type="button"
                                onClick={() => toggleTaskCompletion(task.id)}
                                aria-label={isDone ? "Mark task pending" : "Mark task completed"}
                                className="mt-1"
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-5 w-5 text-[#00D6A0]" />
                                ) : (
                                  <Circle className="h-5 w-5 text-[#6D7C74] hover:text-[#00D6A0] transition" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={cn(
                                      "rounded px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wide",
                                      TASK_TYPE_STYLES[task.taskType] ||
                                        "border-[#B7FFE8]/[0.08] bg-[#080D0C] text-[#A0ADA6]"
                                    )}
                                  >
                                    {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                                  </span>
                                  <span className="font-mono text-[10px] text-[#A0ADA6]">
                                    {task.allocatedMinutes} min
                                  </span>
                                  <span className="font-mono text-[10px] text-[#00D6A0]">
                                    P{task.priorityScore.toFixed(0)}
                                  </span>
                                </div>
                                <p
                                  className={cn(
                                    "text-xs sm:text-sm font-semibold tracking-tight",
                                    isDone ? "text-[#6D7C74] line-through" : "text-[#F1F7F4]"
                                  )}
                                >
                                  {task.title}
                                </p>
                                <p className="text-xs leading-relaxed text-[#A0ADA6]">
                                  {task.description}
                                </p>
                                <div className="pt-2 flex flex-wrap items-center gap-2">
                                  {task.citationReference && (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#B7FFE8]/[0.08] bg-[#080D0C] px-2 py-0.5 text-[10px] font-mono text-[#A0ADA6]">
                                      <BookOpen className="h-3 w-3 text-[#00D6A0]" />
                                      {task.citationReference}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTopicTitle(task.topicTitle);
                                      setCopilotOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#00D6A0]/30 bg-[#00D6A0]/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-[#00D6A0] hover:bg-[#00D6A0]/20 transition"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    <span>Ask Copilot</span>
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
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 p-4 text-xs text-[#FBBF24]">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {plan.deferredTasksCount} candidate revision task{plan.deferredTasksCount === 1 ? "" : "s"} did not fit in your {dailyMinutes} min/day allocation. Increase the daily budget or horizon to include them.
              </span>
            </div>
          )}
        </section>

        {/* Weak topics quick shortcut */}
        <section className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#A0ADA6]">
            <Layers className="h-4 w-4 text-[#00D6A0]" />
            <span>Target Weak Topics with Retest</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {topics
              .filter((t) => t.classification === "weak")
              .map((t) => (
                <Link
                  key={t.id}
                  href="/diagnostic"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 px-3 py-1.5 text-xs font-mono font-semibold text-[#F87171] hover:bg-[#F87171]/20 transition"
                >
                  <Clock className="h-3 w-3" /> Retest: {t.title}
                </Link>
              ))}
            {topics.filter((t) => t.classification === "weak").length === 0 && (
              <span className="text-xs text-[#6D7C74] font-mono">No weak topics remaining.</span>
            )}
          </div>
        </section>

        <CopilotDrawer
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          activeTopicTitle={activeTopicTitle}
        />
      </div>
    </div>
  );
}
