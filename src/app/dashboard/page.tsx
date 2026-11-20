"use client";

// ==============================================================================
// GapLens AI — Screen 2: Academic Intelligence Dashboard & Readiness Overview
// File: src/app/dashboard/page.tsx
// Features: Radial preparation coverage gauge, weighted mastery trend,
// exam countdown widget, daily revision tasks preview, and urgent blind spot alert.
// ==============================================================================

import React, { useState } from "react";
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
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";
import { CitationBadge } from "@/components/citation-badge";

export default function DashboardPage() {
  const { workspace, profile, gapReport, topics, revisionSchedule, completedTaskIds, toggleTaskCompletion } =
    useWorkspace();

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-[#0B0F19] text-slate-100">
      {/* =========================================================================
          DASHBOARD HEADER & WELCOME
          ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>ACTIVE WORKSPACE • OS CS-301</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome back, {profile?.full_name?.split(" ")[0] || "Alex"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Here is your verified academic intelligence snapshot for{" "}
            <span className="text-slate-200 font-semibold">{workspace?.title}</span>.
          </p>
        </div>

        {/* Exam Countdown Widget */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-slate-900 to-cyan-950/40 border border-cyan-800/60 rounded-2xl p-4 shadow-lg shrink-0">
          <div className="h-10 w-10 rounded-xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white font-mono">{daysRemaining} Days</span>
              <span className="rounded bg-cyan-950 text-cyan-300 px-1.5 py-0.2 text-[10px] font-mono border border-cyan-800/80">
                Dec 02, 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Final Exam Countdown</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HERO METRICS GRID (4 CARDS)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Preparation Coverage Indicator (Radial Gauge) */}
        <div className="rounded-2xl border border-cyan-900/60 bg-gradient-to-b from-cyan-950/30 to-slate-900/90 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
              Exam Readiness
            </span>
            <span className="rounded bg-cyan-950/80 text-cyan-300 px-2 py-0.5 text-[10px] font-mono border border-cyan-800/60">
              Calibrated
            </span>
          </div>

          <div className="my-3 flex justify-center">
            <RadialProgress
              value={readiness?.readinessScore ?? 74}
              size={120}
              strokeWidth={10}
              label="Ready"
            />
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Preparation Coverage based on assessed syllabus topics & decay-weighted mastery.
          </p>
        </div>

        {/* Metric 2: Weighted Mastery & Trend */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Weighted Mastery
            </span>
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              <TrendingUp className="h-3 w-3" />
              +8% this week
            </div>
          </div>

          <div className="my-4">
            <span className="text-4xl font-extrabold text-white">
              {Math.round(readiness?.averageMastery ?? 68)}%
            </span>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-1000"
                style={{ width: `${readiness?.averageMastery ?? 68}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
            <span>Baseline Prior: 45%</span>
            <span className="text-emerald-400 font-medium">Bayesian Decayed</span>
          </div>
        </div>

        {/* Metric 3: Syllabus Assessment Breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Syllabus Coverage
            </span>
            <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5 text-[10px] font-mono">
              {readiness?.assessedTopicsCount ?? 8} / {readiness?.totalTopicsCount ?? 10}
            </span>
          </div>

          <div className="my-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Strong (≥80%)
              </span>
              <span className="font-mono font-bold">{counts.strong} topics</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium (55–79%)
              </span>
              <span className="font-mono font-bold">{counts.medium} topics</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Weak (&lt;55%)
              </span>
              <span className="font-mono font-bold">{counts.weak} topics</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-600" /> Unassessed
              </span>
              <span className="font-mono font-bold">{counts.unassessed} topics</span>
            </div>
          </div>

          <Link
            href="/materials"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 pt-2 border-t border-slate-800/60"
          >
            Inspect Topic Hierarchy <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 4: Daily Study Allocation */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Today&apos;s Budget
            </span>
            <span className="rounded bg-blue-950 text-blue-300 px-2 py-0.5 text-[10px] font-mono border border-blue-800/80">
              Day 1 Active
            </span>
          </div>

          <div className="my-3">
            <span className="text-3xl font-extrabold text-white">60 mins</span>
            <p className="text-xs text-slate-400 mt-1">
              {day1Tasks.length} scheduled revision tasks for today.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/40">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {completedTaskIds.length} of {day1Tasks.length} tasks completed
              </span>
            </div>
          </div>

          <Link
            href="/planner"
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1 pt-2 border-t border-slate-800/60"
          >
            Adjust Time Budget <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* =========================================================================
          URGENT BLIND SPOT WARNING BANNER
          ========================================================================= */}
      <div className="rounded-2xl border border-rose-900/80 bg-gradient-to-r from-red-950/50 via-slate-900/95 to-slate-900 p-5 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-950 border border-red-700/60 text-red-400 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400 font-mono">
                  Critical Cognitive Disconnect
                </span>
                <span className="rounded-full bg-rose-950 text-rose-300 px-2 py-0.2 text-[10px] font-mono border border-rose-800">
                  High Confidence, 0% Score
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">
                Blind Spot Alert: TLB & Multi-Level Page Tables
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                You marked highest certainty on virtual address translation, but confused effective access time (EAT) calculation during TLB miss penalties.
              </p>
            </div>
          </div>

          <Link
            href="/gap-report"
            className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold px-4 py-2 text-xs shadow-md shadow-rose-900/30 transition inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Review Blind Spot & Citations</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* =========================================================================
          HIGH-PRIORITY DAILY REVISION PREVIEW & QUICK ACTIONS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: High-Priority Daily Revision Preview */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-cyan-400" />
                Today&apos;s Priority Revision Queue
              </h3>
              <p className="text-xs text-slate-400">
                Time-budgeted micro-learning tasks ranked by priority formula.
              </p>
            </div>
            <Link
              href="/planner"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1"
            >
              Open Full Planner <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {day1Tasks.slice(0, 3).map((task) => {
              const isDone = completedTaskIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  className={`rounded-xl border p-4 transition-all flex items-start justify-between gap-3 ${
                    isDone
                      ? "border-slate-800/50 bg-slate-950/40 opacity-60"
                      : "border-slate-800 bg-slate-900/80 hover:border-cyan-500/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleTaskCompletion(task.id)}
                      className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition ${
                        isDone
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "border-slate-700 hover:border-cyan-400 bg-slate-950"
                      }`}
                    >
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                            task.taskType === "practice_drill"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : task.taskType === "copilot_lesson"
                              ? "bg-purple-950 text-purple-300 border border-purple-800"
                              : "bg-blue-950 text-blue-300 border border-blue-800"
                          }`}
                        >
                          {task.taskType.replace("_", " ")}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {task.allocatedMinutes} mins
                        </span>
                      </div>
                      <h4
                        className={`text-sm font-semibold mt-1 ${
                          isDone ? "line-through text-slate-500" : "text-slate-100"
                        }`}
                      >
                        {task.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {task.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/planner"
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 shrink-0 transition"
                  >
                    <Play className="h-3 w-3 text-cyan-400" />
                    <span>Start</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Quick Action Launchers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800">
            Quick Action Launchers
          </h3>

          <div className="space-y-3 text-xs">
            <Link
              href="/diagnostic"
              className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 group-hover:bg-cyan-900 transition">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Diagnostic Lab</h4>
                  <p className="text-[11px] text-slate-400">Take quiz & rubric evaluation</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
            </Link>

            <Link
              href="/gap-report"
              className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-950 text-blue-400 group-hover:bg-blue-900 transition">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Hero Gap Report</h4>
                  <p className="text-[11px] text-slate-400">Mastery matrix & evidence ledger</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
            </Link>

            <Link
              href="/materials"
              className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 group-hover:bg-emerald-900 transition">
                  <FolderGit2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Materials & Graph</h4>
                  <p className="text-[11px] text-slate-400">Upload documents & syllabus DAG</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
            </Link>

            <Link
              href="/planner"
              className="rounded-xl border border-slate-800 bg-slate-900 p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-950 text-purple-400 group-hover:bg-purple-900 transition">
                  <CalendarCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-200">Planner & Copilot</h4>
                  <p className="text-[11px] text-slate-400">Time slider & grounded AI assistant</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
