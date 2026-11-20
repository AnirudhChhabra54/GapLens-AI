"use client";

// ==============================================================================
// GapLens AI — Screen 6: Revision Planner & Grounded Copilot
// File: src/app/planner/page.tsx
// Redesigned: Editorial light-first palette (warm ivory #F7F5F0, warm surface #FFFEFC,
// slate-blue #4C6477, warm clay #85553F, charcoal text #252A2E).
// Realistic knapsack time budgeting, relative day timeline, and grounded task execution.
// ==============================================================================

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  BookOpen,
  MessageSquareCode,
  ShieldCheck,
  Timer,
  Layers,
  ChevronRight,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CopilotDrawer } from "@/components/copilot-drawer";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const TASK_TYPE_LABELS: Record<string, string> = {
  read_source: "Read Source",
  copilot_lesson: "Copilot Lesson",
  practice_drill: "Practice Drill",
  retest: "Topic Retest",
  spaced_review: "Spaced Review",
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
    fetch("/api/planner/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspace.id,
        dailyMinutes: value,
        daysRemaining: plan.totalDays || 7,
        examDate: plan.examDate || workspace.exam_date || null,
      }),
    }).catch(() => undefined);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-brandBorder">
        <PageHeader
          title="Your study plan"
          description="A realistic schedule based on your priorities and the time you have available."
        />

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            onClick={() => setCopilotOpen(true)}
            className="shrink-0"
          >
            <MessageSquareCode className="h-4 w-4" />
            <span>Ask study assistant</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          COMPACT SUMMARY ROW
          ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-brandText-muted block">
            Daily Budget
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold font-mono text-accent">{dailyMinutes}</span>
            <span className="text-xs text-brandText-secondary font-mono">mins / day</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-brandText-muted block">
            Allocated Time
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold font-mono text-brandText-primary">
              {plan.totalAllocatedMinutes}
            </span>
            <span className="text-xs text-brandText-muted font-mono">/ {plan.totalAvailableMinutes} mins</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-brandText-muted block">
            Active Tasks
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold font-mono text-brandText-primary">{pendingCount}</span>
            <span className="text-xs text-brandText-muted font-mono">({effectiveCompleted} done)</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-brandText-muted block">
            Deferred Work
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-2xl font-semibold font-mono",
                plan.deferredTasksCount > 0 ? "text-[#C27803]" : "text-brandText-primary"
              )}
            >
              {plan.deferredTasksCount}
            </span>
            <span className="text-xs text-brandText-muted font-mono">tasks deferred</span>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          TIME BUDGET CONTROL & KNAPSACK INVARIANTS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Time budget slider & presets */}
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-brandBorder">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-brandText-primary">
                Daily Study Time Budget
              </h3>
            </div>
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-accent-soft text-accent">
              {dailyMinutes} mins per day
            </span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min={15}
              max={120}
              step={15}
              value={dailyMinutes}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
              aria-label="Daily study minutes slider"
            />
            <div className="flex justify-between text-[11px] font-mono text-brandText-muted">
              <span>15m</span>
              <span>30m</span>
              <span>45m</span>
              <span>60m</span>
              <span>90m</span>
              <span>120m</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-brandText-muted mr-1 font-mono">Quick presets:</span>
            {[30, 45, 60, 90].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onBudgetChange(preset)}
                className={cn(
                  "px-3 py-1 rounded-control text-xs font-mono transition-colors",
                  dailyMinutes === preset
                    ? "bg-accent text-white font-medium shadow-xs"
                    : "bg-surface-subtle text-brandText-secondary border border-brandBorder hover:border-brandBorder-strong"
                )}
              >
                {preset} min
              </button>
            ))}
          </div>

          <p className="text-xs text-brandText-muted pt-1">
            Changing your budget dynamically recalculates the schedule so your daily workload never exceeds available time.
          </p>
        </Card>

        {/* Right 1 Col: Knapsack Guarantee */}
        <Card className="space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-brandBorder">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-brandText-primary">
                Schedule Principles
              </h3>
            </div>

            <ul className="mt-3 space-y-2 text-xs text-brandText-secondary leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                <span>Strict knapsack: daily allocated time never exceeds your budget.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                <span>Priority rankings reflect diagnosed gaps, exam weights, and prerequisites.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                <span>Completed tasks remain recorded; re-budgeting only adjusts pending items.</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between font-mono">
            <span>Budget utilization:</span>
            <span className="font-semibold text-accent">{utilization.toFixed(0)}%</span>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          DAY-BY-DAY SCHEDULE TIMELINE
          ========================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
          <div>
            <h3 className="text-base font-semibold text-brandText-primary">
              Daily revision timeline
            </h3>
            <p className="text-xs text-brandText-secondary mt-0.5">
              Structured micro-tasks ordered by priority and prerequisite sequence.
            </p>
          </div>

          <Link href="/gap-report" className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1">
            <span>Inspect gap report</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="space-y-5">
          {plan.days.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              {topics.length > 0 ? (
                <>
                  <h4 className="text-sm font-semibold text-brandText-primary">
                    Ready to generate your study schedule
                  </h4>
                  <p className="text-xs text-brandText-secondary max-w-sm mx-auto">
                    You have {topics.length} curriculum topics extracted. Generate a personalized revision plan fitted to your {dailyMinutes} mins/day study budget.
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onBudgetChange(dailyMinutes)}
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Generate study schedule</span>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-semibold text-brandText-primary">No revision tasks scheduled yet</h4>
                  <p className="text-xs text-brandText-secondary max-w-sm mx-auto">
                    Upload your course syllabus in Materials & Graph to generate your structured revision plan.
                  </p>
                  <div className="pt-2">
                    <Link href="/materials">
                      <Button variant="primary" size="sm">
                        <span>Upload materials</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </Card>
          ) : (
            plan.days.map((day) => {
            const done = day.tasks.filter(
              (t) => t.status === "completed" || completedTaskIds.includes(t.id)
            ).length;
            const budgetPct = Math.min(
              100,
              day.availableMinutes > 0 ? (day.allocatedMinutes / day.availableMinutes) * 100 : 0
            );
            const dayLabel =
              day.dayNumber === 1 ? "Today" : day.dayNumber === 2 ? "Tomorrow" : `Day ${day.dayNumber}`;

            return (
              <Card key={day.dayNumber} className="p-0 overflow-hidden">
                {/* Day Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-surface-subtle border-b border-brandBorder">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-control bg-accent-soft text-accent font-mono text-xs font-semibold">
                      {dayLabel}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-brandText-primary block">
                        {day.date}
                      </span>
                      <span className="text-[11px] text-brandText-muted">
                        {day.tasks.length} tasks • {done} completed
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-xs text-brandText-secondary">
                    {day.allocatedMinutes} / {day.availableMinutes} mins
                  </span>
                </div>

                {/* Day Fill Bar */}
                <div className="h-1 bg-surface-muted">
                  <div
                    className="h-1 bg-accent transition-all duration-500"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>

                {/* Task List */}
                <div className="divide-y divide-brandBorder">
                  {day.tasks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-brandText-muted font-mono">
                      No tasks scheduled for this day. Increase your daily budget to schedule more sessions.
                    </div>
                  ) : (
                    day.tasks.map((task) => {
                      const isDone =
                        task.status === "completed" || completedTaskIds.includes(task.id);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "p-4 transition-colors flex items-start justify-between gap-4",
                            isDone ? "bg-surface-subtle/40 opacity-60" : "hover:bg-surface-subtle/30"
                          )}
                        >
                          <div className="flex items-start gap-3.5">
                            <button
                              type="button"
                              onClick={() => toggleTaskCompletion(task.id)}
                              aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                              className={cn(
                                "mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0",
                                isDone
                                  ? "bg-accent border-accent text-white"
                                  : "border-brandBorder-strong bg-surface hover:border-accent"
                              )}
                            >
                              {isDone && <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />}
                            </button>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-subtle border border-brandBorder text-brandText-secondary">
                                  {TASK_TYPE_LABELS[task.taskType] || task.taskType.replace("_", " ")}
                                </span>
                                <span className="font-mono text-[11px] text-brandText-muted">
                                  {task.allocatedMinutes} mins
                                </span>
                                <span className="font-mono text-[11px] text-accent">
                                  Priority {task.priorityScore.toFixed(0)}
                                </span>
                              </div>

                              <h4
                                className={cn(
                                  "text-sm font-medium",
                                  isDone ? "line-through text-brandText-muted" : "text-brandText-primary"
                                )}
                              >
                                {task.title}
                              </h4>

                              <p className="text-xs text-brandText-secondary leading-relaxed">
                                {task.description}
                              </p>

                              <div className="pt-1.5 flex flex-wrap items-center gap-2">
                                {task.citationReference && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-brandText-secondary bg-surface-subtle border border-brandBorder">
                                    <BookOpen className="h-3 w-3 text-accent" />
                                    {task.citationReference}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTopicTitle(task.topicTitle);
                                    setCopilotOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-medium"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span>Discuss with Copilot</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })
          )}
        </div>

        {plan.deferredTasksCount > 0 && (
          <div className="p-4 rounded-card bg-[#FAF5F2] border border-[#E8CFC4] text-xs text-[#85553F] flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {plan.deferredTasksCount} revision task{plan.deferredTasksCount === 1 ? "" : "s"} did not fit into your {dailyMinutes} mins/day budget. Increase your daily available minutes to include them in your schedule.
            </span>
          </div>
        )}
      </div>

      {/* =========================================================================
          SHORTCUT: TARGET WEAK TOPICS WITH RETEST
          ========================================================================= */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-brandBorder">
          <Layers className="h-4 w-4 text-accent" />
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-brandText-secondary">
            Quick Retest Shortcuts
          </h4>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {topics
            .filter((t) => t.classification === "weak")
            .map((t) => (
              <Link
                key={t.id}
                href="/diagnostic"
                className="inline-flex items-center gap-1.5 rounded-control border border-[#E8CFC4] bg-[#FAF2EE] px-3 py-1.5 text-xs text-[#85553F] hover:bg-[#F3E8E1] transition"
              >
                <Clock className="h-3 w-3" />
                <span>Retest: {t.title}</span>
              </Link>
            ))}
          {topics.filter((t) => t.classification === "weak").length === 0 && (
            <span className="text-xs text-brandText-muted font-mono">No weak topics remaining.</span>
          )}
        </div>
      </Card>

      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        activeTopicTitle={activeTopicTitle}
      />
    </div>
  );
}
