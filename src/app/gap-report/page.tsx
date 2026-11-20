"use client";

// ==============================================================================
// GapLens AI — Screen 5: Gap Report (Hero Screen)
// Evidence ledger, mastery matrix, confidence calibration, blind spots, and
// next actions. Every diagnosis points back to observed attempts and citations.
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
  weak: "border-rose-800 bg-rose-950/40 text-rose-300",
  medium: "border-amber-800 bg-amber-950/40 text-amber-300",
  strong: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
  unassessed: "border-slate-700 bg-slate-950 text-slate-400",
};

const EVIDENCE_LABELS: Record<string, string> = {
  early_signal: "Early signal",
  developing_evidence: "Developing evidence",
  strong_evidence: "Strong evidence",
};

export default function GapReportPage() {
  const { workspace, isDemo, gapReport: contextGapReport, topics } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [serverGapReport, setServerGapReport] = useState<GapReportData | null>(null);

  useEffect(() => {
    // Demo mode keeps the locally updated report from workspace context so
    // a submitted retest is visible immediately. Live workspaces fetch server state.
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-[#0B0F19] text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>SCREEN 5 • GAP REPORT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Where Your Understanding Breaks</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {workspace?.title} · every diagnosis links to an observed answer, an evidence level, and a
            citable source section.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Preparation Coverage — not an exam-score prediction
        </div>
      </div>

      {/* Readiness hero */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-cyan-900/60 bg-gradient-to-b from-cyan-950/35 to-slate-900 p-5 shadow-xl flex items-center gap-5">
          <RadialProgress
            value={gapReport.readiness.readinessScore}
            size={140}
            strokeWidth={12}
            label="Coverage"
          />
          <div>
            <span className="text-[11px] uppercase tracking-wider text-cyan-300 font-bold">
              Preparation Coverage Indicator
            </span>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {gapReport.readiness.assessedTopicsCount} of {gapReport.readiness.totalTopicsCount} syllabus
              topics assessed.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Weighted mastery on assessed topics:{" "}
              <span className="font-semibold text-slate-200">{gapReport.readiness.averageMastery.toFixed(1)}%</span>
            </p>
            {!gapReport.readiness.isDataSufficient && (
              <p className="mt-2 rounded-lg border border-amber-800 bg-amber-950/40 p-2 text-[10px] text-amber-300">
                {gapReport.readiness.insufficiencyReason}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Layers className="h-4 w-4 text-cyan-400" />
            Mastery Matrix
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["weak", "medium", "strong", "unassessed"] as MasteryClassification[]).map((key) => (
              <div key={key} className={cn("rounded-lg border p-3", CLASSIFICATION_STYLES[key])}>
                <span className="text-[10px] uppercase tracking-wider opacity-80">{key}</span>
                <div className="text-2xl font-black font-mono">{counts[key]}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Unassessed topics stay neutral. A one-question result is a provisional signal, never a
            definitive diagnosis.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Brain className="h-4 w-4 text-cyan-400" />
            Confidence Calibration
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400">High-confidence error rate</span>
              <span className="font-mono font-bold text-rose-300">
                {(calibration.highConfidenceErrorRate * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Low-confidence correct rate</span>
                {calibration.lowConfidenceCorrectRate > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-800 bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                    <Sparkles className="h-3 w-3" /> Imposter Alert
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-sky-300">
                {(calibration.lowConfidenceCorrectRate * 100).toFixed(0)}%
              </span>
            </div>
            {calibration.lowConfidenceCorrectRate > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-sky-800/80 bg-sky-950/40 p-2.5 text-[11px] text-sky-300">
                <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />
                <span>
                  <strong>Underconfidence Callout:</strong> {(calibration.lowConfidenceCorrectRate * 100).toFixed(0)}% of correct answers were answered with low confidence. Cognitive calibration indicates underconfidence.
                </span>
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-slate-500">
              {calibration.sampleSufficient
                ? `${calibration.totalAnswers} answers in the demo history are enough to surface a pattern, not to prove a personality trait.`
                : `Only ${calibration.totalAnswers} answers. Treat this as a potential signal — verify with another question.`}
            </p>
          </div>
        </div>
      </div>

      {/* Urgent actions */}
      <section className="rounded-2xl border border-rose-900/50 bg-rose-950/10 p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-bold text-white">Urgent Remediation Queue</h2>
          </div>
          <Link href="/planner" className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1">
            Open planner <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {urgentActions.map((action) => (
            <div key={`${action.topicId}-${action.remedyAction}`} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-xs font-semibold text-slate-100">{action.topicTitle}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{action.remedyAction}</p>
              <div className="mt-2.5">
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
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">High-Confidence Blind Spots</h2>
            <p className="text-xs text-slate-400">
              Confident reasoning that is wrong is more urgent than a low-confidence miss.
            </p>
          </div>
          <span className="rounded-full border border-rose-800 bg-rose-950/50 px-2.5 py-1 text-[10px] font-bold text-rose-300">
            {gapReport.blindSpots.totalBlindSpots} detected
          </span>
        </div>

        {gapReport.blindSpots.items.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
            No high-confidence blind spots in the current evidence.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
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

      {/* Topic evidence matrix */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Evidence Ledger by Topic</h2>
            <p className="text-xs text-slate-400">
              What is weak, what evidence supports it, and what to do next.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", "weak", "medium", "strong", "unassessed"] as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[10px] font-semibold capitalize transition",
                  filter === key
                    ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-300"
                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="hidden md:grid grid-cols-[2fr_100px_110px_90px_90px_120px] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Topic</span>
            <span>Mastery</span>
            <span>Evidence</span>
            <span>Attempts</span>
            <span>Exam weight</span>
            <span>Next action</span>
          </div>
          <div className="divide-y divide-slate-800/80">
            {visibleTopics.map((topic) => (
              <div
                key={topic.topicId}
                className="grid md:grid-cols-[2fr_100px_110px_90px_90px_120px] gap-3 px-4 py-3 text-xs items-center hover:bg-slate-900/60 transition"
              >
                <div>
                  <p className="font-semibold text-slate-100">{topic.topicTitle}</p>
                  <p className="text-[10px] text-slate-500">{topic.unitModule || "Unassigned unit"}</p>
                </div>
                <div>
                  <span className={cn("inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold", CLASSIFICATION_STYLES[topic.classification])}>
                    {topic.masteryScore.toFixed(0)}%
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-cyan-400" />
                    {EVIDENCE_LABELS[topic.evidenceLevel] || "Early signal"}
                  </span>
                  {topic.blindSpotCount > 0 && (
                    <span className="mt-1 block text-rose-400">{topic.blindSpotCount} blind spot</span>
                  )}
                  {(underconfidentTopicIds.has(topic.topicId) || (topic as any).isUnderconfident || (topic as any).underconfidentCount > 0) && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-sky-800 bg-sky-950/60 px-1.5 py-0.5 text-[9px] font-bold text-sky-300">
                      <Sparkles className="h-2.5 w-2.5" /> Underconfident
                    </span>
                  )}
                </div>
                <div className="font-mono text-slate-300">
                  {topic.correctAttempts}/{topic.totalAttempts}
                </div>
                <div className="font-mono text-slate-400">{(topic.examWeight * 100).toFixed(0)}%</div>
                <div>
                  <Link
                    href="/diagnostic"
                    className="inline-flex items-center gap-1 rounded-md border border-cyan-800/70 bg-cyan-950/40 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-900/40"
                  >
                    <Target className="h-3 w-3" /> Retest
                  </Link>
                </div>
              </div>
            ))}
            {visibleTopics.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                No topics match this filter.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Synthesis */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <CheckCircle2 className="h-4 w-4 text-cyan-400" />
          <h3 className="mt-2 text-xs font-bold text-slate-100">What is weak?</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {counts.weak} topic{counts.weak === 1 ? "" : "s"} below the 55% mastery threshold, with{" "}
            {gapReport.blindSpots.totalBlindSpots} high-confidence error pattern
            {gapReport.blindSpots.totalBlindSpots === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          <h3 className="mt-2 text-xs font-bold text-slate-100">What supports it?</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Raw answer scores, rubric keypoint outcomes, and pinned course sections — not generated
            narrative alone.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <ArrowRight className="h-4 w-4 text-cyan-400" />
          <h3 className="mt-2 text-xs font-bold text-slate-100">What next?</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Take a targeted retest, then let the planner reorder pending work around the new evidence.
          </p>
          <Link href="/planner" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400">
            Open revision planner <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
