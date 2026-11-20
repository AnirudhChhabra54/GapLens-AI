"use client";

// ==============================================================================
// GapLens AI — Screen 2: Academic Intelligence Dashboard & Readiness Overview
// File: src/app/dashboard/page.tsx
// Redesigned: Light-first editorial palette (warm ivory #F7F5F0, warm surface #FFFEFC,
// slate-blue #4C6477, warm clay #85553F, charcoal text #252A2E).
// ==============================================================================

import React from "react";
import Link from "next/link";
import {
  Clock,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Layers,
  Stethoscope,
  BarChart3,
  FolderGit2,
  CalendarCheck2,
  Play,
  AlertTriangle,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";

export default function DashboardPage() {
  const {
    workspace,
    profile,
    gapReport,
    topics,
    revisionSchedule,
    completedTaskIds,
    toggleTaskCompletion,
    isDemo,
  } = useWorkspace();

  const readiness = gapReport.readiness;
  const daysRemaining =
    gapReport.daysRemaining ??
    (workspace?.exam_date
      ? Math.max(0, Math.ceil((new Date(workspace.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : isDemo
      ? 12
      : null);

  // Compute status counts from topics
  const counts = { weak: 0, medium: 0, strong: 0, unassessed: 0 };
  for (const t of topics) {
    const classification = (t.classification as keyof typeof counts) || "unassessed";
    if (counts[classification] !== undefined) {
      counts[classification]++;
    } else {
      counts.unassessed++;
    }
  }

  // Day 1 tasks preview
  const day1Tasks = revisionSchedule?.days?.[0]?.tasks || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* =========================================================================
          FIRST ROW: COURSE CONTEXT & WELCOME
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-brandBorder">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-brandText-muted tracking-wide">
            <span className="font-semibold text-accent">{isDemo ? "CS-301" : "Workspace"}</span>
            <span>/</span>
            <span>{workspace?.title || (isDemo ? "Operating Systems" : "My Course")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brandText-primary">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Student"}
          </h1>

          <p className="text-sm text-brandText-secondary max-w-2xl">
            Here is your verified academic preparation overview, calibrated against your course syllabus.
          </p>
        </div>

        {/* Primary Action & Exam Context */}
        <div className="flex items-center gap-3">
          {workspace?.exam_date ? (
            <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-control bg-surface border border-brandBorder text-xs text-brandText-secondary">
              <Clock className="h-4 w-4 text-accent" />
              <span>
                Final exam: <strong className="text-brandText-primary font-medium">{new Date(workspace.exam_date).toLocaleDateString()}</strong> ({daysRemaining} days left)
              </span>
            </div>
          ) : isDemo ? (
            <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-control bg-surface border border-brandBorder text-xs text-brandText-secondary">
              <Clock className="h-4 w-4 text-accent" />
              <span>
                Final exam: <strong className="text-brandText-primary font-medium">Dec 02, 2026</strong> ({daysRemaining} days left)
              </span>
            </div>
          ) : null}

          <Link href="/planner">
            <Button variant="primary">
              <span>Continue studying</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          PRIMARY OVERVIEW: 3 CORE METRIC CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1: Preparation Coverage */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-brandText-muted">
                Preparation Coverage
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent-soft text-accent">
                Calibrated
              </span>
            </div>
            <p className="text-xs text-brandText-secondary leading-relaxed">
              Verified coverage across syllabus topics, weighted by topic importance and evidence confidence.
            </p>
          </div>

          <div className="my-5 flex items-center justify-center">
            <RadialProgress
              value={readiness?.readinessScore ?? 0}
              size={130}
              strokeWidth={9}
              label="Coverage"
            />
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between font-mono">
            <span>Assessed topics:</span>
            <span className="font-semibold text-brandText-primary">
              {readiness?.assessedTopicsCount ?? 0} of {readiness?.totalTopicsCount ?? topics.length}
            </span>
          </div>
        </Card>

        {/* Metric 2: Weighted Mastery */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-brandText-muted">
                Weighted Mastery
              </span>
              <div className="flex items-center gap-1 text-xs text-accent font-medium">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{isDemo ? "+8% prior gain" : "Prior gain"}</span>
              </div>
            </div>
            <p className="text-xs text-brandText-secondary leading-relaxed">
              Bayesian proficiency score updated from recent quiz drills with forgetting curve decay.
            </p>
          </div>

          <div className="my-5 space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-brandText-primary font-mono">
                {Math.round(readiness?.averageMastery ?? 0)}%
              </span>
              <span className="text-xs text-brandText-muted font-mono">/ 100 benchmark</span>
            </div>

            <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700"
                style={{ width: `${readiness?.averageMastery ?? 0}%` }}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between font-mono">
            <span>Prior baseline: 45%</span>
            <span className="text-accent font-medium">Bayesian decay active</span>
          </div>
        </Card>

        {/* Metric 3: Topic Status Distribution */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-brandText-muted">
                Syllabus Status
              </span>
              <Link
                href="/gap-report"
                className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
              >
                Full report <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <p className="text-xs text-brandText-secondary leading-relaxed">
              Categorization based on verified diagnostic assessment accuracy and confidence calibration.
            </p>
          </div>

          <div className="my-4 space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-brandBorder/50">
              <span className="flex items-center gap-2 text-brandText-secondary">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Strong (≥ 80%)
              </span>
              <span className="font-mono font-medium text-brandText-primary">{counts.strong} topics</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-brandBorder/50">
              <span className="flex items-center gap-2 text-brandText-secondary">
                <span className="h-2 w-2 rounded-full bg-[#C27803]" />
                Developing (55–79%)
              </span>
              <span className="font-mono font-medium text-brandText-primary">{counts.medium} topics</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-brandBorder/50">
              <span className="flex items-center gap-2 text-brandText-secondary">
                <span className="h-2 w-2 rounded-full bg-[#B84A39]" />
                Needs work (&lt; 55%)
              </span>
              <span className="font-mono font-medium text-[#B84A39]">{counts.weak} topics</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-2 text-brandText-muted">
                <span className="h-2 w-2 rounded-full bg-brandBorder-strong" />
                Not assessed
              </span>
              <span className="font-mono font-medium text-brandText-muted">{counts.unassessed} topics</span>
            </div>
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between">
            <span>Priority focus:</span>
            <span className="text-[#B84A39] font-medium font-mono">
              {gapReport.blindSpots?.items?.[0]?.topicTitle || (topics.find((t) => t.classification === "weak")?.title) || (isDemo ? "TLB & Page Tables" : "None identified")}
            </span>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          ATTENTION BANNER: CRITICAL BLIND SPOT
          ========================================================================= */}
      {gapReport.blindSpots?.items?.[0] ? (
        <div className="p-4 sm:p-5 rounded-card bg-[#FBF5F2] border border-[#E8CFC4] text-brandText-primary space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-control bg-[#F2DDD3] text-[#85553F] shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#85553F]">
                    Identified Blind Spot
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F2DDD3] text-[#85553F] font-mono">
                    High Confidence • Incorrect
                  </span>
                </div>
                <h3 className="text-base font-semibold text-brandText-primary">
                  {gapReport.blindSpots.items[0].topicTitle}
                </h3>
                <p className="text-xs sm:text-sm text-brandText-secondary leading-relaxed max-w-3xl">
                  {gapReport.blindSpots.items[0].remedyAction || gapReport.blindSpots.items[0].evidenceQuote || "Diagnosed conceptual misconception requiring review."}
                </p>
              </div>
            </div>

            <Link href="/gap-report" className="shrink-0">
              <Button variant="secondary" className="border-[#D8BDB2] text-[#85553F] hover:bg-[#F2DDD3]">
                <span>Inspect in Gap Report</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      ) : null}

      {/* =========================================================================
          RECOMMENDED WORK TODAY & QUICK ACTIONS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Priority Revision Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between pb-4 border-b border-brandBorder">
              <div>
                <h3 className="text-base font-semibold text-brandText-primary flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-accent" />
                  <span>Today&apos;s Recommended Work</span>
                </h3>
                <p className="text-xs text-brandText-secondary mt-0.5">
                  Micro-revision tasks prioritized by your exam deadline and prerequisite dependencies.
                </p>
              </div>

              <Link
                href="/planner"
                className="text-xs text-accent hover:underline font-medium inline-flex items-center gap-1"
              >
                View full plan <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-brandBorder mt-2">
              {day1Tasks.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-xs text-brandText-muted">
                    {topics.length === 0
                      ? "No study plan yet. Upload course materials to extract topics and build your schedule."
                      : "All tasks for today completed! Run a diagnostic drill or adjust your study budget."}
                  </p>
                  <Link href={topics.length === 0 ? "/materials" : "/diagnostic"}>
                    <Button variant="secondary" size="sm" className="mt-2">
                      <span>{topics.length === 0 ? "Upload materials" : "Run diagnostic drill"}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ) : (
                day1Tasks.slice(0, 3).map((task) => {
                  const isDone = completedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`py-3.5 flex items-start justify-between gap-4 transition-colors ${
                        isDone ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleTaskCompletion(task.id)}
                          className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                            isDone
                              ? "bg-accent border-accent text-white"
                              : "border-brandBorder-strong hover:border-accent bg-surface"
                          }`}
                          aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                        >
                          {isDone && <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-subtle border border-brandBorder text-brandText-secondary">
                              {task.taskType.replace("_", " ")}
                            </span>
                            <span className="text-[11px] text-brandText-muted font-mono">
                              {task.allocatedMinutes} mins
                            </span>
                          </div>
                          <h4
                            className={`text-sm font-medium ${
                              isDone ? "line-through text-brandText-muted" : "text-brandText-primary"
                            }`}
                          >
                            {task.title}
                          </h4>
                          <p className="text-xs text-brandText-secondary line-clamp-1">
                            {task.description}
                          </p>
                        </div>
                      </div>

                      <Link href="/planner">
                        <Button variant="quiet" size="sm" className="shrink-0 text-accent">
                          <span>Start</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Quick Portals */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-sm font-semibold text-brandText-primary pb-3 border-b border-brandBorder">
              Core Study Tools
            </h3>

            <div className="divide-y divide-brandBorder">
              <Link
                href="/diagnostic"
                className="py-3 flex items-center justify-between group hover:text-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-control bg-accent-soft text-accent">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-brandText-primary group-hover:text-accent">
                      Diagnostic Lab
                    </h4>
                    <p className="text-[11px] text-brandText-muted">Confidence-coupled assessments</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-brandText-muted group-hover:text-accent group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/gap-report"
                className="py-3 flex items-center justify-between group hover:text-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-control bg-surface-subtle text-brandText-secondary border border-brandBorder">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-brandText-primary group-hover:text-accent">
                      Learning Gaps
                    </h4>
                    <p className="text-[11px] text-brandText-muted">Mastery matrix & verified citations</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-brandText-muted group-hover:text-accent group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/materials"
                className="py-3 flex items-center justify-between group hover:text-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-control bg-surface-subtle text-brandText-secondary border border-brandBorder">
                    <FolderGit2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-brandText-primary group-hover:text-accent">
                      Course Materials & Graph
                    </h4>
                    <p className="text-[11px] text-brandText-muted">Source documents & topic map</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-brandText-muted group-hover:text-accent group-hover:translate-x-0.5 transition" />
              </Link>

              <Link
                href="/planner"
                className="py-3 flex items-center justify-between group hover:text-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-control bg-surface-subtle text-brandText-secondary border border-brandBorder">
                    <CalendarCheck2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-brandText-primary group-hover:text-accent">
                      Revision Planner
                    </h4>
                    <p className="text-[11px] text-brandText-muted">Adaptive schedule & time budget</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-brandText-muted group-hover:text-accent group-hover:translate-x-0.5 transition" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
