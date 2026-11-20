"use client";

// ==============================================================================
// GapLens AI — Screen 4: Diagnostic Lab
// File: src/app/diagnostic/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and decoupled confidence capture.
// ==============================================================================

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
  BookOpen,
  Target,
  Brain,
  X,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CitationBadge } from "@/components/citation-badge";
import type { ConfidenceLevel } from "@/types/database";
import type { QuizEvaluationResponse } from "@/types/assessment";
import { cn } from "@/lib/utils";

const DEMO_QUIZ_ID = "70000000-0000-0000-0000-000000000001";
const DEMO_WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";

interface SafeQuestion {
  id: string;
  topic_id: string;
  question_type: "mcq" | "short_answer";
  question_text: string;
  options: Array<{ id: string; text: string }> | null;
}

const SAFE_QUIZ_QUESTIONS: SafeQuestion[] = [
  {
    id: "80000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000005",
    question_type: "mcq",
    question_text:
      "Why is Peterson's algorithm NOT guaranteed to ensure mutual exclusion on modern multicore processors when compiled directly without synchronization intrinsics?",
    options: [
      {
        id: "A",
        text: "It relies on busy waiting, which always leads to immediate priority inversion and OS kernel deadlock.",
      },
      {
        id: "B",
        text: "It can only support up to two threads and fails to compile on 64-bit operating systems.",
      },
      {
        id: "C",
        text: "Modern out-of-order processors and optimizing compilers can reorder loads and stores past each other in store buffers unless explicit memory fences are inserted.",
      },
      {
        id: "D",
        text: "The turn variable cannot be stored in cache memory and causes hardware bus faults.",
      },
    ],
  },
  {
    id: "80000000-0000-0000-0000-000000000002",
    topic_id: "40000000-0000-0000-0000-000000000002",
    question_type: "short_answer",
    question_text:
      "Distinguish between a TLB Miss and a Page Fault. In your explanation, specify what entity handles each event (hardware vs OS kernel) and the location from which the missing data is fetched.",
    options: null,
  },
  {
    id: "80000000-0000-0000-0000-000000000003",
    topic_id: "40000000-0000-0000-0000-000000000006",
    question_type: "mcq",
    question_text: "In Dijkstra's Banker's Algorithm, what defines a 'safe state'?",
    options: [
      {
        id: "A",
        text: "A state where no process currently holds any locks or shared semaphores.",
      },
      {
        id: "B",
        text: "A state where there exists at least one sequence of all processes such that each can satisfy its maximum remaining needs with current available resources plus resources freed by completed predecessors.",
      },
      {
        id: "C",
        text: "A state where total available physical memory exceeds 50% of swap space.",
      },
      {
        id: "D",
        text: "A state where all processes have identical priority and cannot preempt one another.",
      },
    ],
  },
];

type QuizMode = "diagnostic" | "drill" | "retest" | "exam";

const MODES: Array<{ id: QuizMode; label: string; description: string }> = [
  {
    id: "diagnostic",
    label: "Full Diagnostic",
    description: "Balanced screening across assessed syllabus topics.",
  },
  {
    id: "drill",
    label: "Topic Drill",
    description: "Target focused micro-concepts with deep practice.",
  },
  {
    id: "retest",
    label: "Weak-Topic Retest",
    description: "Reassess low-mastery topics to update the Bayesian prior.",
  },
  {
    id: "exam",
    label: "Exam Simulation",
    description: "High-weight multi-concept questions under standard rubric.",
  },
];

const CONFIDENCE_OPTIONS: Array<{ id: ConfidenceLevel; label: string; tone: string }> = [
  { id: "low", label: "Low Certainty", tone: "border-sky-500/60 text-sky-300 bg-sky-500/15" },
  { id: "medium", label: "Medium Certainty", tone: "border-[#FBBF24]/60 text-[#FBBF24] bg-[#FBBF24]/15" },
  { id: "high", label: "High Certainty", tone: "border-[#00D6A0]/70 text-[#00D6A0] bg-[#00D6A0]/15" },
];

export default function DiagnosticPage() {
  const { workspace, topics, applyAssessmentResults } = useWorkspace();
  const [mode, setMode] = useState<QuizMode>("diagnostic");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, ConfidenceLevel>>({});
  const [result, setResult] = useState<QuizEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  // Dynamic AI question generator preview state
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  const generateDynamicQuizPreview = async () => {
    setGeneratingQuiz(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || DEMO_WORKSPACE_ID,
          targetCount: 4,
          difficulty: 2,
          quizMode: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate dynamic questions.");
      }
      setGeneratedQuestions(data.questions || []);
      setShowGeneratorModal(true);
    } catch (err: any) {
      setError(err?.message || "Failed to run AI question generator.");
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const weakTopicIds = useMemo(
    () => new Set(topics.filter((t) => t.classification === "weak").map((t) => t.id)),
    [topics]
  );

  const questions = useMemo(() => {
    if (mode === "retest" || mode === "drill") {
      const focused = SAFE_QUIZ_QUESTIONS.filter((q) => weakTopicIds.has(q.topic_id));
      return focused.length > 0 ? focused : SAFE_QUIZ_QUESTIONS;
    }
    return SAFE_QUIZ_QUESTIONS;
  }, [mode, weakTopicIds]);

  const activeQuestion = questions[currentIndex];
  const topicTitle = useMemo(
    () => topics.find((t) => t.id === activeQuestion?.topic_id)?.title || "Course topic",
    [activeQuestion, topics]
  );

  const answeredCount = questions.filter(
    (q) => (responses[q.id] || "").trim().length > 0 && Boolean(confidence[q.id])
  ).length;
  const allAnswered = answeredCount === questions.length;
  const activeConfidence = activeQuestion ? confidence[activeQuestion.id] || "medium" : "medium";

  const reset = () => {
    setResponses({});
    setConfidence({});
    setResult(null);
    setError(null);
    setPlanMessage(null);
    setCurrentIndex(0);
  };

  const changeMode = (next: QuizMode) => {
    setMode(next);
    reset();
  };

  const submit = async () => {
    if (!allAnswered) {
      setError("Answer every question and choose a confidence level before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setPlanMessage(null);

    try {
      const payload = {
        quizId: DEMO_QUIZ_ID,
        workspaceId: workspace?.id || DEMO_WORKSPACE_ID,
        answers: questions.map((q) => ({
          questionId: q.id,
          response: responses[q.id],
          confidence: confidence[q.id] || "medium",
        })),
      };

      const res = await fetch("/api/quiz/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "The evaluation service rejected this submission.");
      }

      const evaluation = data as QuizEvaluationResponse;
      setResult(evaluation);

      const blindSpotTopicIds = new Set(
        evaluation.answers.filter((a) => a.isBlindSpot).map((a) => a.topicId)
      );

      const blindSpotByTopic = new Map(
        evaluation.answers
          .filter((a) => a.isBlindSpot)
          .map((answer) => {
            const question = SAFE_QUIZ_QUESTIONS.find(
              (q) => q.id === answer.questionId
            );
            const topic = topics.find((t) => t.id === answer.topicId);
            const citation = answer.citation;
            const item = {
              topicId: answer.topicId,
              topicTitle: topic?.title || "Assessed topic",
              questionId: answer.questionId,
              questionText: question?.question_text || "Diagnostic question",
              studentResponse: responses[answer.questionId] || "",
              correctAnswer: answer.correctAnswer,
              confidence: answer.confidence,
              evidenceQuote: citation?.quote || answer.explanation || "",
              citation,
              remedyAction: citation
                ? `Review ${citation.documentName} p. ${citation.pageStart}-${citation.pageEnd} and re-test this concept.`
                : "Review the source section and re-test this concept.",
            };
            return [answer.topicId, item] as const;
          })
      );

      applyAssessmentResults(
        Object.entries(evaluation.masteryDeltas).map(([topicId, delta]) => ({
          topicId,
          masteryScore: delta.current,
          classification: delta.classification,
          evidenceLevel: delta.evidenceLevel,
          totalAttempts: delta.totalAttempts,
          correctAttempts: delta.correctAttempts,
          isBlindSpot: blindSpotTopicIds.has(topicId),
          blindSpot: blindSpotByTopic.get(topicId),
        }))
      );

      setPlanMessage(
        data.planUpdated
          ? "Pending revision tasks were automatically prioritized based on your updated mastery."
          : "Workspace plan refreshed with new Bayesian mastery evidence."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-[#00D6A0]/[0.035] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#B7FFE8]/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
              <span>[ SYSTEM 04 / DIAGNOSTIC ENGINE ]</span>
              <span className="text-[#6D7C74]">•</span>
              <span className="text-[#A0ADA6]">CALIBRATED LAB</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
              Diagnostic Assessment Lab
            </h1>
            <p className="text-sm text-[#A0ADA6] max-w-2xl">
              Grounded questions derived from indexed course chunks. Metacognitive certainty is recorded prior to scoring to calibrate real vs perceived mastery.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={generateDynamicQuizPreview}
              disabled={generatingQuiz}
              className="inline-flex items-center gap-2 rounded-xl border border-[#00D6A0]/40 bg-[#00D6A0]/10 px-3.5 py-2 text-xs font-mono font-semibold text-[#00D6A0] hover:bg-[#00D6A0]/20 transition disabled:opacity-50 shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#00D6A0]" />
              <span>{generatingQuiz ? "Generating..." : "Preview AI Question Generator"}</span>
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-[#B7FFE8]/[0.1] bg-[#0D1512] px-3.5 py-2 text-xs font-mono text-[#A0ADA6]">
              <ShieldCheck className="h-4 w-4 text-[#00D6A0]" />
              <span>Citations Server-Pinned</span>
            </div>
          </div>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => changeMode(m.id)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all duration-200",
                mode === m.id
                  ? "border-[#00D6A0]/60 bg-[#00D6A0]/[0.08] shadow-lg shadow-[#00D6A0]/10"
                  : "border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 hover:border-[#B7FFE8]/20 hover:bg-[#121D18]"
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold font-mono tracking-tight block",
                  mode === m.id ? "text-[#00D6A0]" : "text-[#F1F7F4]"
                )}
              >
                {m.label}
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-[#A0ADA6]">
                {m.description}
              </span>
            </button>
          ))}
        </div>

        {!result ? (
          <div className="grid lg:grid-cols-[1fr_280px] gap-6">
            <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 sm:p-7 shadow-xl space-y-6">
              {/* Question metadata */}
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#B7FFE8]/[0.06]">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="rounded-lg bg-[#00D6A0]/10 border border-[#00D6A0]/30 px-2.5 py-1 font-mono text-[#00D6A0] font-bold">
                    Q{currentIndex + 1} / {questions.length}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#F1F7F4] font-medium">
                    <BookOpen className="h-3.5 w-3.5 text-[#00D6A0]" />
                    {topicTitle}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#6D7C74]">
                  {activeQuestion?.question_type === "mcq" ? "Single-Answer MCQ" : "Conceptual Short-Answer"}
                </span>
              </div>

              {/* Question prompt */}
              <h2 className="text-base sm:text-lg font-semibold leading-relaxed text-[#F1F7F4]">
                {activeQuestion?.question_text}
              </h2>

              {/* Input choices */}
              <div className="space-y-3">
                {activeQuestion?.question_type === "mcq" && activeQuestion.options
                  ? activeQuestion.options.map((opt) => {
                      const selected = responses[activeQuestion.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setResponses((prev) => ({ ...prev, [activeQuestion.id]: opt.id }))
                          }
                          className={cn(
                            "w-full flex items-start gap-3.5 rounded-xl border p-4 text-left text-xs transition-all duration-200",
                            selected
                              ? "border-[#00D6A0] bg-[#00D6A0]/10 text-[#F1F7F4] shadow-md shadow-[#00D6A0]/10"
                              : "border-[#B7FFE8]/[0.08] bg-[#121D18]/70 text-[#A0ADA6] hover:border-[#00D6A0]/30 hover:bg-[#121D18]"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold transition",
                              selected
                                ? "border-[#00D6A0] bg-[#00D6A0] text-[#080D0C]"
                                : "border-[#B7FFE8]/20 bg-[#080D0C] text-[#A0ADA6]"
                            )}
                          >
                            {opt.id}
                          </span>
                          <span className="leading-relaxed mt-0.5">{opt.text}</span>
                        </button>
                      );
                    })
                  : activeQuestion && (
                      <textarea
                        value={responses[activeQuestion.id] || ""}
                        onChange={(e) =>
                          setResponses((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))
                        }
                        rows={5}
                        placeholder="Explain the concept in your own words. The grading engine evaluates conceptual coverage against the course rubric, not exact verbatim phrasing."
                        className="w-full rounded-xl border border-[#B7FFE8]/[0.1] bg-[#080D0C] p-4 text-xs text-[#F1F7F4] placeholder-[#6D7C74] focus:border-[#00D6A0] focus:ring-1 focus:ring-[#00D6A0] focus:outline-none transition leading-relaxed font-sans"
                      />
                    )}
              </div>

              {/* Confidence capture widget */}
              <div className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/80 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#F1F7F4]">
                  <Brain className="h-4 w-4 text-[#00D6A0]" />
                  <span>Rate your confidence level before grading:</span>
                </div>
                <p className="text-[11px] text-[#A0ADA6]">
                  Confidence does not penalize or inflate your score. It calibrates blind spots (high confidence + incorrect) vs imposter syndrome (low confidence + correct).
                </p>
                <div className="pt-1 flex flex-wrap gap-2.5">
                  {CONFIDENCE_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        activeQuestion &&
                        setConfidence((prev) => ({ ...prev, [activeQuestion.id]: c.id }))
                      }
                      className={cn(
                        "rounded-xl border px-3.5 py-2 text-xs font-mono font-semibold transition-all",
                        activeConfidence === c.id
                          ? c.tone
                          : "border-[#B7FFE8]/[0.08] bg-[#080D0C] text-[#A0ADA6] hover:text-[#F1F7F4]"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 p-3.5 text-xs text-[#F87171]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-between gap-3 border-t border-[#B7FFE8]/[0.06] pt-5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18] px-4 py-2 text-xs font-mono text-[#A0ADA6] hover:text-[#F1F7F4] disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <span className="text-[11px] font-mono text-[#6D7C74]">
                  {answeredCount} / {questions.length} answered
                </span>
                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#17231D] hover:bg-[#00D6A0] hover:text-[#080D0C] border border-[#B7FFE8]/[0.1] px-4 py-2 text-xs font-mono font-semibold text-[#F1F7F4] transition"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submit}
                    disabled={loading || !allAnswered}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00D6A0] hover:bg-[#00D6A0]/90 text-[#080D0C] px-5 py-2.5 text-xs font-mono font-bold shadow-lg shadow-[#00D6A0]/20 disabled:opacity-40 transition"
                  >
                    {loading ? "Evaluating Rubric..." : "Submit Assessment"}
                    <Target className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar information */}
            <aside className="space-y-4">
              <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl space-y-3">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#A0ADA6]">
                  Diagnostic Integrity
                </h3>
                <ul className="space-y-2.5 text-[11px] text-[#A0ADA6]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00D6A0] shrink-0 mt-0.5" />
                    <span>Answer keys and rubrics are kept server-side until evaluation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00D6A0] shrink-0 mt-0.5" />
                    <span>Deterministic MCQ scoring against verified ground truth.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00D6A0] shrink-0 mt-0.5" />
                    <span>Short answers scored via multi-criteria conceptual rubrics.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00D6A0] shrink-0 mt-0.5" />
                    <span>Bayesian mastery updates dynamically recalibrate the study planner.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#00D6A0]/20 bg-[#00D6A0]/[0.04] p-5 text-[11px] text-[#A0ADA6] space-y-2">
                <div className="flex items-center gap-2 text-[#00D6A0] font-semibold font-mono">
                  <Sparkles className="h-4 w-4" />
                  <span>Active Fixture</span>
                </div>
                <p className="leading-relaxed">
                  The CS-301 workspace includes {SAFE_QUIZ_QUESTIONS.length} grounded questions across verified operating systems modules. Retesting updates your live Gap Report immediately.
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Result summary cards */}
            <div className="grid md:grid-cols-3 gap-5">
              <div className="rounded-2xl border border-[#00D6A0]/30 bg-[#0D1512]/90 p-5 sm:p-6 shadow-xl">
                <span className="text-[11px] uppercase tracking-wider text-[#00D6A0] font-mono font-bold">
                  Assessment Score
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold font-mono text-[#F1F7F4]">
                    {result.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-[#A0ADA6] font-mono">
                    ({result.totalScore.toFixed(2)} / {result.maxPossibleScore} pts)
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 sm:p-6 shadow-xl">
                <span className="text-[11px] uppercase tracking-wider text-[#A0ADA6] font-mono font-bold">
                  Cognitive Blind Spots
                </span>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-4xl font-extrabold font-mono",
                      result.newBlindSpotsCount > 0 ? "text-[#F87171]" : "text-[#00D6A0]"
                    )}
                  >
                    {result.newBlindSpotsCount}
                  </span>
                  <span className="text-xs text-[#A0ADA6] font-mono">high-confidence errors</span>
                </div>
                <p className="mt-2 text-[10px] text-[#6D7C74]">
                  High subjective certainty combined with an incorrect answer.
                </p>
              </div>

              <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 sm:p-6 shadow-xl">
                <span className="text-[11px] uppercase tracking-wider text-[#A0ADA6] font-mono font-bold">
                  Planner Calibration
                </span>
                <div className="mt-2.5 flex items-center gap-2 text-sm font-semibold text-[#00D6A0]">
                  <Clock className="h-4 w-4" />
                  <span>{planMessage ? "Refreshed" : "Plan Stable"}</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-[#A0ADA6]">{planMessage}</p>
              </div>
            </div>

            {/* Answer items */}
            {result.answers.map((answer) => {
              const question = SAFE_QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
              const answerTopic = topics.find((t) => t.id === answer.topicId);
              return (
                <div
                  key={answer.questionId}
                  className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 space-y-4 shadow-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#B7FFE8]/[0.06]">
                    <div className="flex items-start gap-3">
                      {answer.isCorrect ? (
                        <div className="p-1 rounded-lg bg-[#00D6A0]/15 text-[#00D6A0] shrink-0 mt-0.5">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-lg bg-[#F87171]/15 text-[#F87171] shrink-0 mt-0.5">
                          <XCircle className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-mono font-bold text-[#00D6A0]">
                          {answerTopic?.title || "Topic"}
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-[#F1F7F4] leading-relaxed">
                          {question?.question_text}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {answer.isBlindSpot && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#F87171]/50 bg-[#F87171]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#F87171]">
                          <AlertTriangle className="h-3 w-3" /> Blind Spot
                        </span>
                      )}
                      {answer.isUncertainSuccess && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-sky-300">
                          <Sparkles className="h-3 w-3" /> Underconfident Correct
                        </span>
                      )}
                      {answer.isCorrect && answer.confidence === "high" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#00D6A0]/50 bg-[#00D6A0]/15 px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#00D6A0]">
                          <CheckCircle2 className="h-3 w-3" /> Aligned Mastery
                        </span>
                      )}
                      <span className="rounded-lg bg-[#080D0C] border border-[#B7FFE8]/[0.1] px-2.5 py-1 font-mono text-[11px] text-[#00D6A0] font-bold">
                        {(answer.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="rounded-xl border border-[#B7FFE8]/[0.06] bg-[#080D0C]/80 p-3.5 space-y-1">
                      <span className="text-[#6D7C74] text-[10px] block uppercase tracking-wider">
                        Your submitted answer
                      </span>
                      <p className="text-[#F1F7F4] font-sans text-xs">
                        {responses[answer.questionId] || "(empty)"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#00D6A0]/20 bg-[#00D6A0]/[0.04] p-3.5 space-y-1">
                      <span className="text-[#00D6A0] text-[10px] block uppercase tracking-wider">
                        Ground truth reference
                      </span>
                      <p className="text-[#F1F7F4] font-sans text-xs">{answer.correctAnswer}</p>
                    </div>
                  </div>

                  {answer.rubricEvaluation && answer.rubricEvaluation.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {answer.rubricEvaluation.map((r) => (
                        <div
                          key={r.keypoint}
                          className="flex items-start justify-between gap-3 rounded-xl border border-[#B7FFE8]/[0.06] bg-[#080D0C]/60 p-3 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#F1F7F4] block">{r.keypoint}</span>
                            <p className="mt-0.5 text-[#A0ADA6] text-[11px]">{r.rationale}</p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold",
                              r.status === "met"
                                ? "bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30"
                                : r.status === "partially_met"
                                ? "bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30"
                                : "bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30"
                            )}
                          >
                            {r.status.replace("_", " ")} · {(r.marks_awarded * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="rounded-xl border border-[#B7FFE8]/[0.06] bg-[#121D18]/70 p-3.5 text-xs leading-relaxed text-[#A0ADA6]">
                    {answer.feedback}
                  </p>

                  <div className="pt-1">
                    <CitationBadge
                      documentName={answer.citation.documentName}
                      pageStart={answer.citation.pageStart}
                      pageEnd={answer.citation.pageEnd}
                      sectionHeading={answer.citation.sectionHeading}
                      quote={answer.citation.quote}
                      isQuoteVerified={answer.citation.isQuoteVerified}
                    />
                  </div>
                </div>
              );
            })}

            {/* Bottom action bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 shadow-xl">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-xl border border-[#B7FFE8]/[0.1] bg-[#121D18] px-4 py-2 text-xs font-mono text-[#F1F7F4] hover:border-[#00D6A0]/40 transition"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#00D6A0]" />
                <span>Take Another Assessment</span>
              </button>
              <div className="flex items-center gap-3">
                <Link
                  href="/gap-report"
                  className="rounded-xl border border-[#B7FFE8]/[0.1] bg-[#121D18] hover:bg-[#17231D] px-4 py-2 text-xs font-mono text-[#F1F7F4] transition"
                >
                  View Gap Report
                </Link>
                <Link
                  href="/planner"
                  className="rounded-xl bg-[#00D6A0] hover:bg-[#00D6A0]/90 text-[#080D0C] px-4 py-2 text-xs font-mono font-bold transition shadow-lg shadow-[#00D6A0]/20"
                >
                  Open Revision Plan
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic AI Generator Preview Modal */}
        {showGeneratorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[#00D6A0]/40 bg-[#0D1512] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#B7FFE8]/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#00D6A0]" />
                  <h3 className="text-base font-bold text-[#F1F7F4]">
                    AI Question Generator Telemetry
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGeneratorModal(false)}
                  className="rounded-lg p-1 text-[#A0ADA6] hover:bg-[#121D18] hover:text-[#F1F7F4] transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-[#00D6A0]/30 bg-[#00D6A0]/[0.06] p-3 text-xs text-[#00D6A0] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#00D6A0] shrink-0" />
                  <span>
                    Generated via <code className="font-mono text-[#B7FFE8]">/api/quiz/generate</code> grounded in indexed Operating Systems chunks.
                  </span>
                </div>
                <span className="rounded bg-[#00D6A0]/10 px-2 py-0.5 text-[10px] font-mono text-[#00D6A0] border border-[#00D6A0]/30 shrink-0">
                  Zero-Leak Projection
                </span>
              </div>

              <div className="space-y-3.5 text-left">
                {generatedQuestions && generatedQuestions.length > 0 ? (
                  generatedQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs text-[#A0ADA6]">
                        <span className="font-mono text-[#00D6A0]">
                          Question {idx + 1} • {q.topicTitle || "Operating Systems"}
                        </span>
                        <span className="rounded bg-[#080D0C] border border-[#B7FFE8]/[0.08] px-2 py-0.5 text-[10px] font-mono uppercase text-[#A0ADA6]">
                          {q.questionType} • Difficulty {q.difficulty || 2}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#F1F7F4] leading-relaxed">
                        {q.questionText}
                      </p>
                      {q.options && Array.isArray(q.options) && (
                        <div className="space-y-1.5 pt-1">
                          {q.options.map((opt: any) => (
                            <div
                              key={opt.id}
                              className="rounded-lg border border-[#B7FFE8]/[0.06] bg-[#080D0C]/60 px-3 py-1.5 text-xs text-[#A0ADA6] flex items-center gap-2"
                            >
                              <span className="font-mono font-bold text-[#00D6A0]">{opt.id}.</span>
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#A0ADA6] py-4 text-center">No questions generated.</p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGeneratorModal(false)}
                  className="rounded-xl bg-[#121D18] hover:bg-[#17231D] px-4 py-2 text-xs font-mono text-[#F1F7F4] border border-[#B7FFE8]/[0.1] transition"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
