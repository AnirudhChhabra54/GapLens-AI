"use client";

// ==============================================================================
// GapLens AI — Screen 5: Gap Report (Hero Screen)
// File: src/app/gap-report/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and grounded evidence ledgers.
// ==============================================================================

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Target,
  Activity,
  Brain,
  Layers,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";
import { BlindSpotCard } from "@/components/blind-spot-card";
import { CitationBadge } from "@/components/citation-badge";
import { computeConfidenceMetrics, type EvaluatedAnswerInput } from "@/lib/algorithms/blind-spots";
import { DEMO_ANSWERS } from "@/lib/demo/os-cs301-fixture";
import type { MasteryClassification } from "@/types/database";
import type { GapReportData } from "@/types/assessment";
import { cn } from "@/lib/utils";

type Filter = "all" | MasteryClassification;

const CLASSIFICATION_STYLES: Record<MasteryClassification, string> = {
  weak: "border-[#F87171]/40 bg-[#F87171]/10 text-[#F87171]",
  medium: "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]",
  strong: "border-[#00D6A0]/40 bg-[#00D6A0]/10 text-[#00D6A0]",
  unassessed: "border-[#B7FFE8]/[0.08] bg-[#080D0C] text-[#6D7C74]",
};

const EVIDENCE_LABELS: Record<string, string> = {
  early_signal: "Early Signal",
  developing_evidence: "Developing Evidence",
  strong_evidence: "Strong Evidence",
};

export default function GapReportPage() {
  const { workspace, isDemo, gapReport: contextGapReport, topics } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [serverGapReport, setServerGapReport] = useState<GapReportData | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    const controller = new AbortController();
    fetch(`/api/gap-report?workspaceId=${encodeURIComponent(workspace.id)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.readiness && Array.isArray(data.topics)) {
          setServerGapReport(data);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [workspace.id, isDemo]);

  const gapReport = isDemo || !serverGapReport ? contextGapReport : serverGapReport;

  const counts = useMemo(() => {
    const next = { weak: 0, medium: 0, strong: 0, unassessed: 0 };
    for (const t of gapReport.topics) {
      if (next[t.classification] !== undefined) next[t.classification]++;
    }
    return next;
  }, [gapReport.topics]);

  const calibration = useMemo(() => {
    if (gapReport.blindSpots?.calibration) {
      return gapReport.blindSpots.calibration;
    }
    const topicMap = new Map(gapReport.topics.map((t) => [t.topicId, t]));
    const inputs: EvaluatedAnswerInput[] = DEMO_ANSWERS.map((a) => {
      const citation = gapReport.blindSpots?.items?.find(
        (item) => item.questionId === a.quiz_question_id
      )?.citation;
      return {
        topicId: a.topic_id,
        topicTitle: topicMap.get(a.topic_id)?.topicTitle || "Topic",
        questionId: a.quiz_question_id,
        questionText: "Recorded attempt",
        studentResponse: a.student_response,
        correctAnswer: "Evaluated server-side",
        confidence: a.confidence,
        score: a.score,
        citation: citation || {
          chunkId: "unavailable",
          documentId: "",
          documentName: "Recorded assessment",
          docType: "material",
          pageStart: 1,
          pageEnd: 1,
          sectionHeading: null,
          quote: null,
          isQuoteVerified: false,
        },
      };
    });
    return computeConfidenceMetrics(inputs);
  }, [gapReport]);

  const underconfidentTopicIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of DEMO_ANSWERS) {
      if (a.is_correct && a.confidence === "low") {
        ids.add(a.topic_id);
      }
    }
    for (const t of gapReport.topics) {
      if ((t as any).isUnderconfident || (t as any).underconfidentCount > 0) {
        ids.add(t.topicId);
      }
    }
    return ids;
  }, [gapReport.topics]);

  const visibleTopics =
    filter === "all" ? gapReport.topics : gapReport.topics.filter((t) => t.classification === filter);

  const urgentActions =
    gapReport.urgentActions && gapReport.urgentActions.length > 0
      ? gapReport.urgentActions
      : gapReport.blindSpots.items.slice(0, 4).map((b) => ({
          topicId: b.topicId,
          topicTitle: b.topicTitle,
          remedyAction: b.remedyAction,
          citation: b.citation,
        }));

  return (
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-[#00D6A0]/[0.035] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#B7FFE8]/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
              <span>[ SYSTEM 05 / COGNITIVE GAP ANALYSIS ]</span>
              <span className="text-[#6D7C74]">•</span>
              <span className="text-[#A0ADA6]">HERO EVIDENCE REPORT</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
              Where Your Understanding Breaks
            </h1>
            <p className="text-sm text-[#A0ADA6] max-w-2xl">
              {workspace?.title} • Every diagnostic finding links directly to an observed answer, an evidence level, and an indexed textbook citation.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#00D6A0]/30 bg-[#0D1512] px-3.5 py-2 text-xs font-mono text-[#00D6A0] shrink-0">
            <ShieldCheck className="h-4 w-4 text-[#00D6A0]" />
            <span>Preparation Coverage Gauge</span>
          </div>
        </div>

        {/* Readiness hero metrics (3 cards) */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Card 1: Radial Gauge */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl flex items-center gap-6">
            <div className="shrink-0">
              <RadialProgress
                value={gapReport.readiness.readinessScore}
                size={135}
                strokeWidth={11}
                label="Coverage"
              />
            </div>
            <div className="space-y-1.5 min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-[#00D6A0] font-mono font-bold block">
                Preparation Indicator
              </span>
              <p className="text-xs text-[#A0ADA6] leading-relaxed">
                {gapReport.readiness.assessedTopicsCount} of {gapReport.readiness.totalTopicsCount} syllabus topics assessed.
              </p>
              <p className="text-xs text-[#A0ADA6]">
                Weighted mastery:{" "}
                <span className="font-mono font-bold text-[#F1F7F4]">
                  {gapReport.readiness.averageMastery.toFixed(1)}%
                </span>
              </p>
              {!gapReport.readiness.isDataSufficient && (
                <p className="mt-2 rounded-lg border border-[#FBBF24]/30 bg-[#FBBF24]/10 p-2 text-[10px] text-[#FBBF24] font-mono">
                  {gapReport.readiness.insufficiencyReason}
                </p>
              )}
            </div>
          </div>

          {/* Card 2: Mastery Matrix */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#B7FFE8]/[0.06]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A0ADA6] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#00D6A0]" />
                  Mastery Matrix
                </span>
                <span className="text-[10px] font-mono text-[#6D7C74]">10 Total Topics</span>
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                {(["weak", "medium", "strong", "unassessed"] as MasteryClassification[]).map((key) => (
                  <div key={key} className={cn("rounded-xl border p-3", CLASSIFICATION_STYLES[key])}>
                    <span className="text-[10px] uppercase font-mono tracking-wider block opacity-80">
                      {key}
                    </span>
                    <div className="text-2xl font-black font-mono mt-0.5">{counts[key]}</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-[#6D7C74] font-mono">
              Unassessed topics stay neutral until diagnosed with evidence.
            </p>
          </div>

          {/* Card 3: Confidence Calibration */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#B7FFE8]/[0.06]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A0ADA6] flex items-center gap-2">
                  <Brain className="h-4 w-4 text-[#00D6A0]" />
                  Confidence Calibration
                </span>
                <span className="text-[10px] font-mono text-[#00D6A0]">Metacognitive</span>
              </div>
              <div className="mt-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between rounded-xl border border-[#F87171]/30 bg-[#F87171]/[0.06] p-3">
                  <span className="text-[#A0ADA6]">High-confidence error rate</span>
                  <span className="font-bold text-[#F87171]">
                    {(calibration.highConfidenceErrorRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#A0ADA6]">Low-confidence correct</span>
                    {calibration.lowConfidenceCorrectRate > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/20 px-2 py-0.2 text-[9px] font-bold text-sky-300">
                        <Sparkles className="h-2.5 w-2.5" /> Imposter
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-sky-300">
                    {(calibration.lowConfidenceCorrectRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-[#6D7C74]">
              {calibration.sampleSufficient
                ? `${calibration.totalAnswers} recorded answers surface a clear cognitive pattern.`
                : `${calibration.totalAnswers} recorded answers. A signal to verify with retests.`}
            </p>
          </div>
        </div>

        {/* Urgent actions banner */}
        <section className="rounded-2xl border border-[#F87171]/40 bg-gradient-to-r from-[#F87171]/[0.08] via-[#0D1512] to-[#0D1512] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F87171]/20">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#F87171]/20 text-[#F87171]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold font-mono text-[#F1F7F4] uppercase tracking-wider">
                Urgent Remediation Priority Queue
              </h2>
            </div>
            <Link
              href="/planner"
              className="text-xs font-mono text-[#00D6A0] hover:text-[#B7FFE8] inline-flex items-center gap-1 transition"
            >
              Open Planner <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {urgentActions.map((action) => (
              <div
                key={`${action.topicId}-${action.remedyAction}`}
                className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/80 p-4 space-y-3"
              >
                <div>
                  <p className="text-xs font-bold text-[#F1F7F4]">{action.topicTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#A0ADA6]">
                    {action.remedyAction}
                  </p>
                </div>
                <div>
                  <CitationBadge
                    documentName={action.citation.documentName}
                    pageStart={action.citation.pageStart}
                    pageEnd={action.citation.pageEnd}
                    sectionHeading={action.citation.sectionHeading}
                    quote={action.citation.quote}
                    isQuoteVerified={action.citation.isQuoteVerified}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Blind spots */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#B7FFE8]/[0.08]">
            <div>
              <h2 className="text-lg font-bold text-[#F1F7F4]">High-Confidence Blind Spots</h2>
              <p className="text-xs text-[#A0ADA6] mt-0.5">
                Confident reasoning that is objectively incorrect. More dangerous than low-confidence gaps.
              </p>
            </div>
            <span className="rounded-full border border-[#F87171]/50 bg-[#F87171]/15 px-3 py-1 text-xs font-mono font-bold text-[#F87171]">
              {gapReport.blindSpots.totalBlindSpots} Detected
            </span>
          </div>

          {gapReport.blindSpots.items.length === 0 ? (
            <div className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/60 p-6 text-center text-xs text-[#A0ADA6]">
              No high-confidence blind spots detected in the current assessment evidence.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {gapReport.blindSpots.items.map((item) => (
                <BlindSpotCard
                  key={item.questionId}
                  topicTitle={item.topicTitle}
                  topicId={item.topicId}
                  confidence={item.confidence}
                  studentResponse={item.studentResponse}
                  correctAnswer={item.correctAnswer}
                  misconceptionRationale={item.evidenceQuote ?? undefined}
                  remedyAction={item.remedyAction}
                  citation={item.citation}
                />
              ))}
            </div>
          )}
        </section>

        {/* Topic evidence ledger */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#B7FFE8]/[0.08]">
            <div>
              <h2 className="text-lg font-bold text-[#F1F7F4]">Evidence Ledger by Topic</h2>
              <p className="text-xs text-[#A0ADA6] mt-0.5">
                Grounded breakdown: mastery levels, attempt ratios, exam weights, and next actions.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {(["all", "weak", "medium", "strong", "unassessed"] as Filter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "rounded-lg border px-3 py-1 capitalize transition-all",
                    filter === key
                      ? "border-[#00D6A0] bg-[#00D6A0]/15 text-[#00D6A0] font-bold"
                      : "border-[#B7FFE8]/[0.08] bg-[#0D1512] text-[#A0ADA6] hover:text-[#F1F7F4]"
                  )}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 shadow-xl">
            <div className="hidden md:grid grid-cols-[2fr_100px_130px_90px_90px_110px] gap-4 border-b border-[#B7FFE8]/[0.06] bg-[#080D0C]/80 px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[#6D7C74]">
              <span>Topic</span>
              <span>Mastery</span>
              <span>Evidence Level</span>
              <span>Attempts</span>
              <span>Exam Weight</span>
              <span>Action</span>
            </div>
            <div className="divide-y divide-[#B7FFE8]/[0.04]">
              {visibleTopics.map((topic) => (
                <div
                  key={topic.topicId}
                  className="grid md:grid-cols-[2fr_100px_130px_90px_90px_110px] gap-4 px-5 py-4 text-xs items-center hover:bg-[#121D18]/60 transition"
                >
                  <div>
                    <p className="font-semibold text-[#F1F7F4]">{topic.topicTitle}</p>
                    <p className="text-[11px] text-[#6D7C74] font-mono mt-0.5">
                      {topic.unitModule || "Operating Systems"}
                    </p>
                  </div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-lg border px-2.5 py-0.5 font-mono text-xs font-bold",
                        CLASSIFICATION_STYLES[topic.classification]
                      )}
                    >
                      {topic.masteryScore.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-[#A0ADA6] space-y-1">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Activity className="h-3 w-3 text-[#00D6A0]" />
                      {EVIDENCE_LABELS[topic.evidenceLevel] || "Early Signal"}
                    </span>
                    {topic.blindSpotCount > 0 && (
                      <span className="inline-block text-[#F87171] font-mono text-[10px]">
                        {topic.blindSpotCount} Blind Spot
                      </span>
                    )}
                    {(underconfidentTopicIds.has(topic.topicId) ||
                      (topic as any).isUnderconfident ||
                      (topic as any).underconfidentCount > 0) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.2 text-[9px] font-mono font-bold text-sky-300">
                        <Sparkles className="h-2.5 w-2.5" /> Underconfident
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[#F1F7F4]">
                    {topic.correctAttempts} / {topic.totalAttempts}
                  </div>
                  <div className="font-mono text-[#A0ADA6]">
                    {(topic.examWeight * 100).toFixed(0)}%
                  </div>
                  <div>
                    <Link
                      href="/diagnostic"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#00D6A0]/40 bg-[#00D6A0]/10 px-3 py-1.5 text-xs font-mono font-semibold text-[#00D6A0] hover:bg-[#00D6A0]/20 transition"
                    >
                      <Target className="h-3 w-3" /> Retest
                    </Link>
                  </div>
                </div>
              ))}
              {visibleTopics.length === 0 && (
                <div className="px-5 py-8 text-center text-xs text-[#6D7C74] font-mono">
                  No topics match this classification filter.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Synthesis: The 3 Core Pillars */}
        <section className="grid md:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 space-y-2">
            <CheckCircle2 className="h-5 w-5 text-[#00D6A0]" />
            <h3 className="text-sm font-bold text-[#F1F7F4]">1. What is weak?</h3>
            <p className="text-xs leading-relaxed text-[#A0ADA6]">
              {counts.weak} topic{counts.weak === 1 ? "" : "s"} below 55% mastery threshold, with{" "}
              {gapReport.blindSpots.totalBlindSpots} high-confidence error pattern
              {gapReport.blindSpots.totalBlindSpots === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 space-y-2">
            <BookOpen className="h-5 w-5 text-[#00D6A0]" />
            <h3 className="text-sm font-bold text-[#F1F7F4]">2. What supports it?</h3>
            <p className="text-xs leading-relaxed text-[#A0ADA6]">
              Observed answers, multi-criteria rubric keypoints, and pinned course citations — not ungrounded LLM hallucinations.
            </p>
          </div>
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 space-y-2 flex flex-col justify-between">
            <div>
              <ArrowRight className="h-5 w-5 text-[#00D6A0]" />
              <h3 className="text-sm font-bold text-[#F1F7F4] mt-2">3. What next?</h3>
              <p className="text-xs leading-relaxed text-[#A0ADA6]">
                Target high-yield topics with the knapsack revision planner or retest to refresh Bayesian mastery.
              </p>
            </div>
            <Link
              href="/planner"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-[#00D6A0] hover:text-[#B7FFE8] transition"
            >
              <span>Open Knapsack Planner</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
