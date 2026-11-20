"use client";

// ==============================================================================
// GapLens AI — Screen 2: Academic Intelligence Dashboard & Readiness Overview
// File: src/app/dashboard/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and clear student decision architecture.
// ==============================================================================

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Calendar,
  Layers,
  Stethoscope,
  BarChart3,
  FolderGit2,
  CalendarCheck2,
  Play,
  ShieldAlert,
  Zap,
  Target,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";

export default function DashboardPage() {
  const {
    workspace,
    profile,
    gapReport,
    topics,
    revisionSchedule,
    completedTaskIds,
    toggleTaskCompletion,
  } = useWorkspace();

  const readiness = gapReport.readiness;
  const daysRemaining = gapReport.daysRemaining ?? 14;

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
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] relative overflow-hidden">
      {/* Background atmospheric emerald ambient glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-[#00D6A0]/[0.035] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-[-100px] w-[500px] h-[400px] bg-[#00D6A0]/[0.02] rounded-full blur-[160px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            DASHBOARD HEADER & WELCOME
            ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#B7FFE8]/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
              <span>[ SYSTEM 02 / ACADEMIC INTELLIGENCE ]</span>
              <span className="text-[#6D7C74]">•</span>
              <span className="text-[#A0ADA6]">OS CS-301</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
              Welcome back,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F1F7F4] via-[#B7FFE8] to-[#00D6A0]">
                {profile?.full_name?.split(" ")[0] || "Alex"}
              </span>
            </h1>
            <p className="text-sm text-[#A0ADA6] max-w-2xl">
              Verified learning diagnosis & exam readiness telemetry for{" "}
              <span className="text-[#F1F7F4] font-medium">{workspace?.title}</span>.
            </p>
          </div>

          {/* Exam Countdown Widget */}
          <div className="flex items-center gap-3.5 bg-[#0D1512] border border-[#B7FFE8]/[0.1] rounded-2xl p-4 shadow-xl shrink-0 backdrop-blur-md">
            <div className="h-11 w-11 rounded-xl bg-[#00D6A0]/10 border border-[#00D6A0]/30 flex items-center justify-center text-[#00D6A0]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold font-mono text-[#F1F7F4]">
                  {daysRemaining} Days
                </span>
                <span className="rounded bg-[#00D6A0]/10 text-[#00D6A0] px-1.5 py-0.5 text-[10px] font-mono border border-[#00D6A0]/30">
                  Dec 02, 2026
                </span>
              </div>
              <p className="text-[11px] text-[#A0ADA6] uppercase tracking-wider font-mono">
                Final Exam Countdown
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            HERO METRICS GRID (4 CARDS)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Metric 1: Preparation Coverage Indicator (Radial Gauge) */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl flex flex-col justify-between relative overflow-hidden group hover:border-[#00D6A0]/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D6A0]/[0.03] rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0ADA6]">
                Prep Coverage
              </span>
              <span className="rounded bg-[#00D6A0]/10 text-[#00D6A0] px-2 py-0.5 text-[10px] font-mono border border-[#00D6A0]/25">
                Calibrated
              </span>
            </div>

            <div className="my-3 flex justify-center">
              <RadialProgress
                value={readiness?.readinessScore ?? 74}
                size={124}
                strokeWidth={10}
                label="Ready"
              />
            </div>

            <p className="text-[11px] text-[#A0ADA6] text-center leading-relaxed">
              Decay-weighted score across all assessed syllabus topics & verified concepts.
            </p>
          </div>

          {/* Metric 2: Weighted Mastery & Trend */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl flex flex-col justify-between group hover:border-[#00D6A0]/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0ADA6]">
                Weighted Mastery
              </span>
              <div className="flex items-center gap-1 text-[#00D6A0] text-xs font-semibold bg-[#00D6A0]/10 px-2 py-0.5 rounded border border-[#00D6A0]/30">
                <TrendingUp className="h-3 w-3" />
                <span>+8%</span>
              </div>
            </div>

            <div className="my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold font-mono text-[#F1F7F4]">
                  {Math.round(readiness?.averageMastery ?? 68)}%
                </span>
                <span className="text-xs text-[#A0ADA6] font-mono">/ 100</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-[#17231D] overflow-hidden p-[1px]">
                <div
                  className="h-full bg-gradient-to-r from-[#00D6A0] to-[#B7FFE8] rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(0,214,160,0.4)]"
                  style={{ width: `${readiness?.averageMastery ?? 68}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#A0ADA6] pt-2 border-t border-[#B7FFE8]/[0.06] font-mono">
              <span>Baseline Prior: 45%</span>
              <span className="text-[#00D6A0]">Bayesian Decay Active</span>
            </div>
          </div>

          {/* Metric 3: Syllabus Assessment Breakdown */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl flex flex-col justify-between group hover:border-[#00D6A0]/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0ADA6]">
                Syllabus Topics
              </span>
              <span className="rounded bg-[#121D18] text-[#F1F7F4] px-2 py-0.5 text-[10px] font-mono border border-[#B7FFE8]/[0.1]">
                {readiness?.assessedTopicsCount ?? 8} / {readiness?.totalTopicsCount ?? 10} Assessed
              </span>
            </div>

            <div className="my-3 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#A0ADA6]">
                <span className="flex items-center gap-1.5 text-[#00D6A0]">
                  <span className="h-2 w-2 rounded-full bg-[#00D6A0] shadow-[0_0_6px_rgba(0,214,160,0.5)]" />{" "}
                  Strong (≥80%)
                </span>
                <span className="font-mono font-bold text-[#F1F7F4]">{counts.strong}</span>
              </div>
              <div className="flex items-center justify-between text-[#A0ADA6]">
                <span className="flex items-center gap-1.5 text-[#FBBF24]">
                  <span className="h-2 w-2 rounded-full bg-[#FBBF24]" /> Developing (55–79%)
                </span>
                <span className="font-mono font-bold text-[#F1F7F4]">{counts.medium}</span>
              </div>
              <div className="flex items-center justify-between text-[#A0ADA6]">
                <span className="flex items-center gap-1.5 text-[#F87171]">
                  <span className="h-2 w-2 rounded-full bg-[#F87171]" /> Weak (&lt;55%)
                </span>
                <span className="font-mono font-bold text-[#F1F7F4]">{counts.weak}</span>
              </div>
              <div className="flex items-center justify-between text-[#6D7C74]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#6D7C74]" /> Unassessed
                </span>
                <span className="font-mono font-bold">{counts.unassessed}</span>
              </div>
            </div>

            <Link
              href="/materials"
              className="text-[11px] text-[#00D6A0] hover:text-[#B7FFE8] font-mono inline-flex items-center gap-1 pt-2 border-t border-[#B7FFE8]/[0.06] transition"
            >
              Inspect DAG Hierarchy <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Metric 4: Daily Study Allocation */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl flex flex-col justify-between group hover:border-[#00D6A0]/30 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#A0ADA6]">
                Today&apos;s Budget
              </span>
              <span className="rounded bg-[#00D6A0]/10 text-[#00D6A0] px-2 py-0.5 text-[10px] font-mono border border-[#00D6A0]/30">
                Day 1 Active
              </span>
            </div>

            <div className="my-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-[#F1F7F4]">60</span>
                <span className="text-sm font-mono text-[#A0ADA6]">mins allocated</span>
              </div>
              <p className="text-xs text-[#A0ADA6] mt-1">
                {day1Tasks.length} prioritized micro-revision tasks.
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[#00D6A0] bg-[#00D6A0]/[0.06] p-2 rounded-xl border border-[#00D6A0]/20 font-mono">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00D6A0]" />
                <span>
                  {completedTaskIds.length} of {day1Tasks.length} tasks completed
                </span>
              </div>
            </div>

            <Link
              href="/planner"
              className="text-[11px] text-[#00D6A0] hover:text-[#B7FFE8] font-mono inline-flex items-center gap-1 pt-2 border-t border-[#B7FFE8]/[0.06] transition"
            >
              Adjust Time Budget <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* =========================================================================
            URGENT BLIND SPOT WARNING BANNER (High-Confidence Misconception)
            ========================================================================= */}
        <div className="rounded-2xl border border-[#F87171]/40 bg-gradient-to-r from-[#F87171]/[0.08] via-[#0D1512] to-[#0D1512] p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-80 h-full bg-[#F87171]/[0.03] pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 text-[#F87171] shrink-0 mt-0.5">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#F87171]">
                    [ CRITICAL COGNITIVE DISCONNECT ]
                  </span>
                  <span className="rounded-full bg-[#F87171]/15 text-[#F87171] px-2.5 py-0.5 text-[10px] font-mono border border-[#F87171]/40">
                    High Confidence • 0% Score
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#F1F7F4]">
                  Blind Spot Alert: TLB & Multi-Level Page Tables
                </h3>
                <p className="text-xs sm:text-sm text-[#A0ADA6] max-w-2xl leading-relaxed">
                  You indicated high certainty on virtual address translation, but confused effective access time (EAT) calculation during TLB miss penalties.
                </p>
              </div>
            </div>

            <Link
              href="/gap-report"
              className="rounded-xl bg-[#F87171] hover:bg-[#F87171]/90 text-[#080D0C] font-semibold px-4 py-2.5 text-xs shadow-lg shadow-[#F87171]/20 transition inline-flex items-center justify-center gap-2 shrink-0 font-mono tracking-tight"
            >
              <span>Inspect Gap Report</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* =========================================================================
            HIGH-PRIORITY DAILY REVISION PREVIEW & QUICK ACTIONS
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: High-Priority Daily Revision Preview */}
          <div className="lg:col-span-2 rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#B7FFE8]/[0.06]">
              <div>
                <h3 className="text-base font-bold text-[#F1F7F4] flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-[#00D6A0]" />
                  <span>Today&apos;s Priority Revision Queue</span>
                </h3>
                <p className="text-xs text-[#A0ADA6] mt-0.5">
                  Time-budgeted micro-learning tasks ranked by priority formula.
                </p>
              </div>
              <Link
                href="/planner"
                className="text-xs text-[#00D6A0] hover:text-[#B7FFE8] font-mono inline-flex items-center gap-1 transition"
              >
                Full Planner <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {day1Tasks.slice(0, 3).map((task) => {
                const isDone = completedTaskIds.includes(task.id);
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border p-4 transition-all duration-200 flex items-start justify-between gap-4 ${
                      isDone
                        ? "border-[#B7FFE8]/[0.04] bg-[#080D0C]/40 opacity-55"
                        : "border-[#B7FFE8]/[0.08] bg-[#121D18]/70 hover:border-[#00D6A0]/40 hover:bg-[#121D18]"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => toggleTaskCompletion(task.id)}
                        className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-[#00D6A0] border-[#00D6A0] text-[#080D0C]"
                            : "border-[#B7FFE8]/20 hover:border-[#00D6A0] bg-[#080D0C]"
                        }`}
                      >
                        {isDone && <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                              task.taskType === "practice_drill"
                                ? "bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/30"
                                : task.taskType === "copilot_lesson"
                                ? "bg-purple-500/10 text-purple-300 border border-purple-500/30"
                                : "bg-sky-500/10 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {task.taskType.replace("_", " ")}
                          </span>
                          <span className="text-[11px] text-[#6D7C74] font-mono">
                            {task.allocatedMinutes} mins
                          </span>
                        </div>
                        <h4
                          className={`text-sm font-semibold tracking-tight ${
                            isDone ? "line-through text-[#6D7C74]" : "text-[#F1F7F4]"
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-xs text-[#A0ADA6] line-clamp-1">
                          {task.description}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/planner"
                      className="rounded-lg bg-[#17231D] hover:bg-[#00D6A0] hover:text-[#080D0C] text-[#F1F7F4] px-3 py-1.5 text-xs font-mono inline-flex items-center gap-1.5 shrink-0 transition border border-[#B7FFE8]/[0.1]"
                    >
                      <Play className="h-3 w-3 text-[#00D6A0] group-hover:text-[#080D0C]" />
                      <span>Start</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 1 Col: Quick Action Launchers */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-[#F1F7F4] pb-4 border-b border-[#B7FFE8]/[0.06] flex items-center justify-between">
                <span>System Portals</span>
                <span className="text-[10px] font-mono text-[#00D6A0]">[ READY ]</span>
              </h3>

              <div className="space-y-3 pt-3">
                <Link
                  href="/diagnostic"
                  className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-3.5 hover:border-[#00D6A0]/40 hover:bg-[#121D18] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/20 group-hover:border-[#00D6A0]/50 transition">
                      <Stethoscope className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#F1F7F4]">Diagnostic Lab</h4>
                      <p className="text-[11px] text-[#A0ADA6]">Confidence-coupled quizzes</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6D7C74] group-hover:text-[#00D6A0] group-hover:translate-x-0.5 transition" />
                </Link>

                <Link
                  href="/gap-report"
                  className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-3.5 hover:border-[#00D6A0]/40 hover:bg-[#121D18] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/20 group-hover:border-[#00D6A0]/50 transition">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#F1F7F4]">Hero Gap Report</h4>
                      <p className="text-[11px] text-[#A0ADA6]">Mastery matrix & citations</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6D7C74] group-hover:text-[#00D6A0] group-hover:translate-x-0.5 transition" />
                </Link>

                <Link
                  href="/materials"
                  className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-3.5 hover:border-[#00D6A0]/40 hover:bg-[#121D18] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/20 group-hover:border-[#00D6A0]/50 transition">
                      <FolderGit2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#F1F7F4]">Materials & DAG</h4>
                      <p className="text-[11px] text-[#A0ADA6]">Upload files & inspect graph</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6D7C74] group-hover:text-[#00D6A0] group-hover:translate-x-0.5 transition" />
                </Link>

                <Link
                  href="/planner"
                  className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-3.5 hover:border-[#00D6A0]/40 hover:bg-[#121D18] transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/20 group-hover:border-[#00D6A0]/50 transition">
                      <CalendarCheck2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-[#F1F7F4]">Planner & Copilot</h4>
                      <p className="text-[11px] text-[#A0ADA6]">Knapsack planner & AI tutor</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6D7C74] group-hover:text-[#00D6A0] group-hover:translate-x-0.5 transition" />
                </Link>
              </div>
            </div>

            <div className="pt-4 border-t border-[#B7FFE8]/[0.06]">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6D7C74]">
                <span>Grounding: 100% Strict</span>
                <span className="text-[#00D6A0]">Citation Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
