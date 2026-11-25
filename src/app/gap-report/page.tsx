"use client";

// ==============================================================================
// GapLens AI — Screen 5: Gap Report (Hero Diagnostic Screen)
// File: src/app/gap-report/page.tsx
// Redesigned: Editorial light-first palette (warm ivory #F7F5F0, warm surface #FFFEFC,
// slate-blue #4C6477, warm clay #85553F, charcoal text #252A2E).
// Honest confidence calibration, transparent evidence ledger, and grounded citations.
// ==============================================================================

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
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
  Download,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";
import { BlindSpotCard } from "@/components/blind-spot-card";
import { CitationBadge } from "@/components/citation-badge";
import { computeConfidenceMetrics, type EvaluatedAnswerInput } from "@/lib/algorithms/blind-spots";
import { simulateForgettingCurve } from "@/lib/algorithms/forgetting-curve";
import { detectConfusionPairs } from "@/lib/algorithms/confusion-pairs";
import { DEMO_ANSWERS } from "@/lib/demo/os-cs301-fixture";
import type { MasteryClassification } from "@/types/database";
import type { GapReportData } from "@/types/assessment";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

type Filter = "all" | MasteryClassification;

const EVIDENCE_LABELS: Record<string, string> = {
  early_signal: "Early Signal",
  developing_evidence: "Developing Evidence",
  strong_evidence: "Strong Evidence",
};

export default function GapReportPage() {
  const { workspace, isDemo, gapReport: contextGapReport, topics } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [serverGapReport, setServerGapReport] = useState<GapReportData | null>(null);
  const [timeMachineDays, setTimeMachineDays] = useState<number>(0);

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
    if (!isDemo) {
      return {
        highConfidenceErrorRate: 0,
        lowConfidenceCorrectRate: 0,
        brierScore: 0,
        alignmentRatio: 0,
        totalAnswers: 0,
        sampleSufficient: false,
      };
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
  }, [gapReport, isDemo]);

  const underconfidentTopicIds = useMemo(() => {
    const ids = new Set<string>();
    if (isDemo) {
      for (const a of DEMO_ANSWERS) {
        if (a.is_correct && a.confidence === "low") {
          ids.add(a.topic_id);
        }
      }
    }
    for (const t of gapReport.topics) {
      if ((t as any).isUnderconfident || (t as any).underconfidentCount > 0) {
        ids.add(t.topicId);
      }
    }
    return ids;
  }, [gapReport.topics, isDemo]);

  const visibleTopics =
    filter === "all" ? gapReport.topics : gapReport.topics.filter((t) => t.classification === filter);

  const urgentActions =
    gapReport.urgentActions && gapReport.urgentActions.length > 0
      ? gapReport.urgentActions
      : gapReport.blindSpots.items.slice(0, 2).map((b) => ({
          topicId: b.topicId,
          topicTitle: b.topicTitle,
          remedyAction: b.remedyAction,
          citation: b.citation,
        }));

  const downloadSurvivalMarkdown = () => {
    const weakTopics = gapReport.topics.filter(
      (t) => t.classification === "weak" || t.classification === "medium"
    );
    const blindSpots = gapReport.blindSpots?.items || [];
    const lines: string[] = [
      `# ${gapReport.workspaceTitle || "Course"} — Exam-Day Survival Pack`,
      `Generated: ${new Date().toLocaleDateString()}`,
      `Preparation Coverage: ${Math.round(gapReport.readiness?.readinessScore ?? 0)}%`,
      "",
      "## High-Confidence Blind Spots (Fix First)",
      ...(blindSpots.length > 0
        ? blindSpots.map(
            (b) =>
              `### ${b.topicTitle}\n- **Trap Question:** ${b.questionText}\n- **Your Misconception:** ${b.studentResponse}\n- **Verified Answer:** ${b.correctAnswer}\n- **Source Citation:** ${b.citation?.documentName || "Course Notes"} (p. ${b.citation?.pageStart || 1}-${b.citation?.pageEnd || 1})\n- **Quote:** > ${b.evidenceQuote || b.citation?.quote || ""}\n`
          )
        : ["- No high-confidence blind spots recorded yet."]),
      "",
      "## Priority Weak & Developing Topics",
      ...(weakTopics.length > 0
        ? weakTopics.map(
            (t) =>
              `- **${t.topicTitle}** (${t.classification.toUpperCase()} • ${Math.round(t.masteryScore)}% mastery • ${Math.round((t.examWeight || 0) * 100)}% exam weight)`
          )
        : ["- All assessed topics are currently strong!"]),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exam-survival-pack.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAnkiCsv = () => {
    const blindSpots = gapReport.blindSpots?.items || [];
    const rows = [
      ["Front", "Back", "Tags"],
      ...(blindSpots.length > 0
        ? blindSpots.map((b) => [
            b.questionText,
            `${b.correctAnswer} [Source: ${b.citation?.documentName || "Notes"} p.${b.citation?.pageStart || 1}]`,
            `gaplens blind_spot ${b.topicTitle.replace(/\s+/g, "_").toLowerCase()}`,
          ])
        : gapReport.topics
            .filter((t) => t.classification === "weak")
            .map((t) => [
              `Explain key mechanisms & edge cases of ${t.topicTitle}`,
              `Current mastery: ${Math.round(t.masteryScore)}% — Review source unit ${t.unitModule || "Core"}`,
              `gaplens weak_topic`,
            ])),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gaplens-anki-flashcards.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-brandBorder">
        <PageHeader
          title="Your learning gaps"
          description="See which topics need attention, what your answers reveal and where to focus next."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadSurvivalMarkdown}
            title="Download Markdown cheat sheet of weak topics and blind spots"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Cheat sheet (.md)</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={downloadAnkiCsv}
            title="Export blind spots as Anki-ready CSV flashcards"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Anki deck (.csv)</span>
          </Button>
          <Link href="/planner">
            <Button variant="primary" size="sm">
              <span>View revision plan</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          SECTION A: PREPARATION SUMMARY (3 CARDS)
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
              Measured from verified diagnostic accuracy across syllabus topics, weighted by topic importance.
            </p>
          </div>

          <div className="my-4 flex items-center justify-center">
            <RadialProgress
              value={gapReport.readiness.readinessScore}
              size={120}
              strokeWidth={9}
              label="Coverage"
            />
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between font-mono">
            <span>Assessed topics:</span>
            <span className="font-semibold text-brandText-primary">
              {gapReport.readiness.assessedTopicsCount} of {gapReport.readiness.totalTopicsCount}
            </span>
          </div>
        </Card>

        {/* Metric 2: Topic Mastery Matrix */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-brandText-muted">
                Mastery Distribution
              </span>
              <span className="text-[11px] font-mono text-brandText-muted">
                {gapReport.topics.length} total topics
              </span>
            </div>
            <p className="text-xs text-brandText-secondary leading-relaxed">
              Categorization based on verified diagnostic assessment scores and prior Bayesian decay.
            </p>
          </div>

          <div className="my-3 grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-control bg-surface-subtle border border-brandBorder">
              <span className="text-[10px] font-mono uppercase text-[#B84A39] block font-medium">Needs work</span>
              <div className="text-xl font-semibold font-mono text-brandText-primary mt-0.5">{counts.weak}</div>
            </div>
            <div className="p-2.5 rounded-control bg-surface-subtle border border-brandBorder">
              <span className="text-[10px] font-mono uppercase text-[#C27803] block font-medium">Developing</span>
              <div className="text-xl font-semibold font-mono text-brandText-primary mt-0.5">{counts.medium}</div>
            </div>
            <div className="p-2.5 rounded-control bg-surface-subtle border border-brandBorder">
              <span className="text-[10px] font-mono uppercase text-accent block font-medium">Strong</span>
              <div className="text-xl font-semibold font-mono text-brandText-primary mt-0.5">{counts.strong}</div>
            </div>
            <div className="p-2.5 rounded-control bg-surface-subtle border border-brandBorder">
              <span className="text-[10px] font-mono uppercase text-brandText-muted block font-medium">Not assessed</span>
              <div className="text-xl font-semibold font-mono text-brandText-primary mt-0.5">{counts.unassessed}</div>
            </div>
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted flex items-center justify-between font-mono">
            <span>Average mastery:</span>
            <span className="font-semibold text-brandText-primary">
              {gapReport.readiness.averageMastery.toFixed(0)}%
            </span>
          </div>
        </Card>

        {/* Metric 3: Confidence Calibration */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-brandText-muted">
                Confidence Calibration
              </span>
              <span className="text-[11px] font-mono text-accent">Metacognitive</span>
            </div>
            <p className="text-xs text-brandText-secondary leading-relaxed">
              Comparison between your stated confidence and objective diagnostic correctness.
            </p>
          </div>

          <div className="my-3 space-y-2 text-xs">
            <div className="p-2.5 rounded-control bg-[#FAF2EE] border border-[#E8CFC4] flex items-center justify-between">
              <div>
                <span className="font-medium text-[#85553F] block">High-confidence mistakes</span>
                <span className="text-[10px] text-brandText-muted">Blind spots needing correction</span>
              </div>
              <span className="text-base font-semibold font-mono text-[#85553F]">
                {(calibration.highConfidenceErrorRate * 100).toFixed(0)}%
              </span>
            </div>

            <div className="p-2.5 rounded-control bg-surface-subtle border border-brandBorder flex items-center justify-between">
              <div>
                <span className="font-medium text-brandText-primary block">Low-confidence correct</span>
                <span className="text-[10px] text-brandText-muted">Underconfident knowledge</span>
              </div>
              <span className="text-base font-semibold font-mono text-accent">
                {(calibration.lowConfidenceCorrectRate * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-brandBorder text-xs text-brandText-muted">
            {calibration.sampleSufficient
              ? `${calibration.totalAnswers} recorded attempts show a clear cognitive pattern.`
              : `${calibration.totalAnswers} recorded attempts. Retesting will increase confidence precision.`}
          </div>
        </Card>
      </div>

      {/* Ebbinghaus Exam-Day Forgetting-Curve Time Machine */}
      {gapReport.topics.length > 0 && (() => {
        const maxDays = Math.max(14, gapReport.daysRemaining || 14);
        const sim = simulateForgettingCurve(gapReport.topics, timeMachineDays);
        return (
          <Card className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-brandBorder">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-brandText-primary">
                    Exam-Day Forgetting-Curve Time Machine
                  </h3>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-mono text-accent">
                    Ebbinghaus Retention Model
                  </span>
                </div>
                <p className="text-xs text-brandText-secondary mt-0.5">
                  Scrub forward to simulate memory decay without spaced review and spot &quot;Silent Cliff&quot; topics before exam day.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                <span className="px-2.5 py-1 rounded bg-surface-subtle border border-brandBorder text-brandText-primary">
                  {timeMachineDays === 0 ? "Today (Day 0)" : `+${timeMachineDays} days`}
                </span>
                <span className="px-2.5 py-1 rounded bg-accent-soft text-accent font-semibold">
                  Projected Avg: {sim.projectedAverageMastery}%
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={maxDays}
                step={1}
                value={Math.min(timeMachineDays, maxDays)}
                onChange={(e) => setTimeMachineDays(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
                aria-label="Simulate forgetting curve days ahead"
              />
              <div className="flex justify-between text-[11px] font-mono text-brandText-muted">
                <span>Today</span>
                <span>+{Math.round(maxDays / 2)} days</span>
                <span>Exam Horizon (+{maxDays} days)</span>
              </div>
            </div>

            {timeMachineDays > 0 && sim.silentCliffTopics.length > 0 && (
              <div className="rounded-control border border-[#E8CFC4] bg-[#FEF9F2] p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#C27803]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    {sim.silentCliffTopics.length} Silent Cliff topic{sim.silentCliffTopics.length === 1 ? "" : "s"} projected to drop below 55% by Day +{timeMachineDays}:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {sim.silentCliffTopics.map((cliff) => (
                    <span
                      key={cliff.topicId}
                      className="rounded bg-surface border border-[#E8CFC4] px-2 py-0.5 text-[11px] font-mono text-brandText-primary"
                    >
                      {cliff.topicTitle}: {Math.round(cliff.currentMastery)}% →{" "}
                      <strong className="text-[#B84A39]">{Math.round(cliff.projectedMastery)}%</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })()}

      {/* Semantic Confusion Pair Drills */}
      {gapReport.topics.length >= 2 && (() => {
        const pairs = detectConfusionPairs(gapReport.topics, 2);
        if (pairs.length === 0) return null;
        return (
          <Card className="space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-brandBorder">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-brandText-primary">
                  High-Risk Concept Confusion Pairs
                </h3>
              </div>
              <span className="text-[11px] font-mono text-brandText-muted">
                Detected via Jina 768d semantic proximity
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pairs.map((pair, idx) => (
                <div
                  key={idx}
                  className="rounded-control border border-brandBorder bg-surface-subtle p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-brandText-primary truncate">
                      {pair.topicA.topicTitle} ↔ {pair.topicB.topicTitle}
                    </div>
                    <p className="text-[11px] text-brandText-secondary">{pair.reason}</p>
                  </div>
                  <Link href={`/diagnostic?mode=drill&topicId=${encodeURIComponent(pair.topicA.topicId)}`} className="shrink-0">
                    <Button variant="secondary" size="sm">
                      <span>Contrast Drill</span>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      {gapReport.topics.length === 0 ? (
        <Card className="p-10 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
            <BookOpen className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-brandText-primary">No diagnostic assessment data yet</h3>
            <p className="text-xs text-brandText-secondary max-w-md mx-auto leading-relaxed">
              Upload your course syllabus in Materials & Graph to extract topics, then take a diagnostic assessment to calibrate your readiness and uncover blind spots.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link href="/materials">
              <Button variant="primary" size="sm">
                <span>Upload course materials</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* =========================================================================
              SECTION B: PRIORITY RECOMMENDATIONS (Restrained Attention Panel)
              ========================================================================= */}
      <div className="p-5 rounded-card bg-[#FDF9F7] border border-[#E8CFC4] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8CFC4]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-control bg-[#F2DDD3] text-[#85553F]">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-brandText-primary">
                Recommended next steps
              </h3>
              <p className="text-xs text-brandText-secondary">
                Target these prioritized gaps to build foundational prerequisites.
              </p>
            </div>
          </div>

          <Link href="/planner">
            <Button variant="secondary" size="sm" className="border-[#D8BDB2] text-[#85553F]">
              <span>Open study plan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {urgentActions.map((action) => (
            <div
              key={`${action.topicId}-${action.remedyAction}`}
              className="bg-surface rounded-control border border-brandBorder p-3.5 space-y-2.5"
            >
              <div>
                <h4 className="text-xs font-semibold text-brandText-primary">{action.topicTitle}</h4>
                <p className="text-xs text-brandText-secondary mt-0.5 leading-relaxed">
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
      </div>

      {/* =========================================================================
          SECTION C: HIGH-CONFIDENCE BLIND SPOTS
          ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
          <div>
            <h3 className="text-base font-semibold text-brandText-primary">
              High-confidence blind spots ({gapReport.blindSpots.totalBlindSpots})
            </h3>
            <p className="text-xs text-brandText-secondary mt-0.5">
              Identified questions where confidence was high but the reasoning was incorrect.
            </p>
          </div>
        </div>

        {gapReport.blindSpots.items.length === 0 ? (
          <div className="rounded-card border border-brandBorder bg-surface p-6 text-center text-xs text-brandText-muted">
            No high-confidence blind spots detected in current assessment evidence.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* =========================================================================
          SECTION D: TOPIC EVIDENCE LEDGER
          ========================================================================= */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brandBorder">
          <div>
            <h3 className="text-base font-semibold text-brandText-primary">
              Evidence ledger by topic
            </h3>
            <p className="text-xs text-brandText-secondary mt-0.5">
              Verified breakdown of mastery scores, attempt counts, and exam weights.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-surface-subtle p-1 rounded-control border border-brandBorder text-xs">
            {(["all", "weak", "medium", "strong", "unassessed"] as Filter[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "px-3 py-1 rounded-control capitalize transition-colors font-medium",
                  filter === key
                    ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder"
                    : "text-brandText-muted hover:text-brandText-primary border border-transparent"
                )}
              >
                {key === "weak" ? "Needs work" : key === "medium" ? "Developing" : key}
              </button>
            ))}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-brandBorder text-brandText-muted font-medium">
                <th className="py-2.5 px-3">Topic</th>
                <th className="py-2.5 px-3">Mastery</th>
                <th className="py-2.5 px-3">Evidence signal</th>
                <th className="py-2.5 px-3">Attempts</th>
                <th className="py-2.5 px-3">Exam weight</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandBorder">
              {visibleTopics.map((topic) => (
                <tr key={topic.topicId} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-medium text-brandText-primary">{topic.topicTitle}</p>
                    <p className="text-[11px] text-brandText-muted font-mono mt-0.5">
                      {topic.unitModule || "Operating Systems"}
                    </p>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded font-mono text-xs font-medium",
                        topic.classification === "strong"
                          ? "bg-accent-soft text-accent"
                          : topic.classification === "medium"
                          ? "bg-[#FEF5E7] text-[#C27803]"
                          : topic.classification === "weak"
                          ? "bg-[#FDF0EE] text-[#B84A39]"
                          : "bg-surface-subtle text-brandText-muted"
                      )}
                    >
                      {topic.masteryScore.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <span className="flex items-center gap-1.5 text-brandText-secondary font-mono text-[11px]">
                        <Activity className="h-3 w-3 text-accent" />
                        {EVIDENCE_LABELS[topic.evidenceLevel] || "Early Signal"}
                      </span>
                      {topic.blindSpotCount > 0 && (
                        <span className="inline-block text-[#B84A39] font-mono text-[10px]">
                          {topic.blindSpotCount} Blind spot
                        </span>
                      )}
                      {(underconfidentTopicIds.has(topic.topicId) ||
                        (topic as any).isUnderconfident ||
                        (topic as any).underconfidentCount > 0) && (
                        <span className="inline-block text-accent font-mono text-[10px]">
                          Underconfident
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-brandText-secondary">
                    {topic.correctAttempts} / {topic.totalAttempts}
                  </td>
                  <td className="py-3 px-3 font-mono text-brandText-secondary">
                    {(topic.examWeight * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Link href={`/diagnostic?mode=retest&topicId=${topic.topicId}`}>
                      <Button variant="quiet" size="sm" className="text-accent">
                        <Target className="h-3 w-3" />
                        <span>Retest</span>
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {visibleTopics.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-brandText-muted font-mono">
                    No topics match this classification filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* =========================================================================
          SECTION E: SYNTHESIS PILLARS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="space-y-2">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-semibold text-brandText-primary">1. What needs attention?</h4>
          <p className="text-xs leading-relaxed text-brandText-secondary">
            {counts.weak} topic{counts.weak === 1 ? "" : "s"} below 55% threshold, with{" "}
            {gapReport.blindSpots.totalBlindSpots} high-confidence misconception pattern
            {gapReport.blindSpots.totalBlindSpots === 1 ? "" : "s"}.
          </p>
        </Card>

        <Card className="space-y-2">
          <BookOpen className="h-4 w-4 text-accent" />
          <h4 className="text-sm font-semibold text-brandText-primary">2. What supports it?</h4>
          <p className="text-xs leading-relaxed text-brandText-secondary">
            Observed student responses, multi-criteria rubric evaluations, and pinned course citations — not ungrounded predictions.
          </p>
        </Card>

        <Card className="space-y-2 flex flex-col justify-between">
          <div>
            <ArrowRight className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-semibold text-brandText-primary mt-2">3. What next?</h4>
            <p className="text-xs leading-relaxed text-brandText-secondary">
              Work through prioritized tasks in your study plan or complete targeted drills to update your mastery.
            </p>
          </div>
          <Link href="/planner" className="pt-2 text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium">
            <span>Open study plan</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
