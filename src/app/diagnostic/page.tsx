"use client";

// ==============================================================================
// GapLens AI — Screen 4: Diagnostic Lab
// Grounded MCQ + short-answer runner with explicit confidence capture, server
// evaluation, verified citations, rubric feedback, and automatic re-planning.
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
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CitationBadge } from "@/components/citation-badge";
// Client-safe question projection: intentionally contains no answer keys, rubric
// weights, explanations, or citation quotes. The server route owns grading.
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
      { id: "A", text: "It relies on busy waiting, which always leads to immediate priority inversion and OS kernel deadlock." },
      { id: "B", text: "It can only support up to two threads and fails to compile on 64-bit operating systems." },
      { id: "C", text: "Modern out-of-order processors and optimizing compilers can reorder loads and stores past each other in store buffers unless explicit memory fences are inserted." },
      { id: "D", text: "The turn variable cannot be stored in cache memory and causes hardware bus faults." },
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
      { id: "A", text: "A state where no process currently holds any locks or shared semaphores." },
      { id: "B", text: "A state where there exists at least one sequence of all processes such that each can satisfy its maximum remaining needs with current available resources plus resources freed by completed predecessors." },
      { id: "C", text: "A state where total available physical memory exceeds 50% of swap space." },
      { id: "D", text: "A state where all processes have identical priority and cannot preempt one another." },
    ],
  },
];
import type { ConfidenceLevel } from "@/types/database";
import type { QuizEvaluationResponse } from "@/types/assessment";
import { cn } from "@/lib/utils";

type QuizMode = "diagnostic" | "drill" | "retest" | "exam";

const MODES: Array<{ id: QuizMode; label: string; description: string }> = [
  {
    id: "diagnostic",
    label: "Full Diagnostic",
    description: "Balanced screening across assessed topics.",
  },
  {
    id: "drill",
    label: "Topic Drill",
    description: "Target one weak area with focused practice.",
  },
  {
    id: "retest",
    label: "Weak-Topic Retest",
    description: "Reassess low-mastery topics and refresh the plan.",
  },
  {
    id: "exam",
    label: "Exam Simulation",
    description: "Timed-style mixed practice under the same rubric.",
  },
];

const CONFIDENCE_OPTIONS: Array<{ id: ConfidenceLevel; label: string; tone: string }> = [
  { id: "low", label: "Low", tone: "border-sky-700 text-sky-300 bg-sky-950/50" },
  { id: "medium", label: "Medium", tone: "border-amber-700 text-amber-300 bg-amber-950/40" },
  { id: "high", label: "High", tone: "border-emerald-700 text-emerald-300 bg-emerald-950/40" },
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
          ? "Pending revision tasks were re-ordered automatically from the new evidence."
          : "Demo plan refreshed locally from the new mastery evidence. Configure Supabase to persist it."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6 bg-[#0B0F19] text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>SCREEN 4 • DIAGNOSTIC LAB</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Evidence-Grounded Assessment</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Every question is grounded in indexed course chunks. Confidence is recorded separately from
            correctness and never changes the mastery score.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={generateDynamicQuizPreview}
            disabled={generatingQuiz}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-700/80 bg-cyan-950/60 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 transition disabled:opacity-50 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>{generatingQuiz ? "Generating Questions..." : "Preview AI Question Generator"}</span>
          </button>
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300">Citations pinned server-side</span>
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
              "rounded-xl border p-3 text-left transition",
              mode === m.id
                ? "border-cyan-500/60 bg-cyan-950/40 shadow-lg shadow-cyan-500/10"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
            )}
          >
            <span className={cn("text-xs font-bold", mode === m.id ? "text-cyan-300" : "text-slate-200")}>
              {m.label}
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{m.description}</span>
          </button>
        ))}
      </div>

      {!result ? (
        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 font-mono text-cyan-300">
                  Q{currentIndex + 1}/{questions.length}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                  {topicTitle}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                {activeQuestion?.question_type === "mcq" ? "Single-answer MCQ" : "Short conceptual answer"}
              </span>
            </div>

            <h2 className="mt-5 text-base sm:text-lg font-semibold leading-relaxed text-slate-100">
              {activeQuestion?.question_text}
            </h2>

            <div className="mt-5 space-y-2.5">
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
                          "w-full flex items-start gap-3 rounded-xl border p-3 text-left text-xs transition",
                          selected
                            ? "border-cyan-500/70 bg-cyan-950/40 text-slate-100"
                            : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px]",
                            selected
                              ? "border-cyan-400 bg-cyan-500 text-slate-950"
                              : "border-slate-700 text-slate-400"
                          )}
                        >
                          {opt.id}
                        </span>
                        <span className="leading-relaxed">{opt.text}</span>
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
                      placeholder="Explain the concept in your own words. The rubric checks conceptual coverage, not exact wording."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
                    />
                  )}
            </div>

            {/* Confidence capture */}
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Brain className="h-4 w-4 text-cyan-400" />
                How confident are you in this answer?
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Confidence does not affect whether the answer is correct. It is used to detect blind spots
                and underconfidence.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {CONFIDENCE_OPTIONS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      activeQuestion &&
                      setConfidence((prev) => ({ ...prev, [activeQuestion.id]: c.id }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition",
                      activeConfidence === c.id ? c.tone : "border-slate-800 bg-slate-900 text-slate-400"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[11px] text-slate-500">
                {answeredCount}/{questions.length} answered + confidence set
              </span>
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={loading || !allAnswered}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-40"
                >
                  {loading ? "Evaluating..." : "Submit Assessment"}
                  <Target className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Assessment Integrity</h3>
              <ul className="mt-3 space-y-2 text-[11px] text-slate-400">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Answer keys and rubrics stay server-side until submission.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  MCQ grading is deterministic.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Short answers are scored from backend rubric weights.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Retests update mastery history and pending tasks.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-cyan-900/50 bg-cyan-950/20 p-4 text-[11px] text-slate-400">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                <Sparkles className="h-4 w-4" />
                Demo coverage
              </div>
              <p className="mt-2 leading-relaxed">
                The synthetic CS-301 workspace ships with {SAFE_QUIZ_QUESTIONS.length} grounded questions
                across {new Set(SAFE_QUIZ_QUESTIONS.map((q) => q.topic_id)).size} assessed topics.
                Unassessed topics are explicitly labelled in the Gap Report.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Result summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-cyan-800/60 bg-gradient-to-b from-cyan-950/40 to-slate-900 p-5">
              <span className="text-[11px] uppercase tracking-wider text-cyan-300 font-bold">Assessment Score</span>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-black font-mono text-white">{result.percentage.toFixed(1)}%</span>
                <span className="pb-1 text-xs text-slate-400">
                  {result.totalScore.toFixed(2)}/{result.maxPossibleScore} points
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Confidence Blind Spots</span>
              <div className="mt-2 flex items-end gap-2">
                <span className={cn("text-4xl font-black font-mono", result.newBlindSpotsCount > 0 ? "text-rose-400" : "text-emerald-400")}>
                  {result.newBlindSpotsCount}
                </span>
                <span className="pb-1 text-xs text-slate-400">high-confidence errors</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                A blind spot is a follow-up signal, not a diagnosis of ability.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Plan Refresh</span>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Clock className="h-4 w-4" />
                {planMessage ? "Updated" : "No pending work"}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{planMessage}</p>
            </div>
          </div>

          {result.answers.map((answer) => {
            const question = SAFE_QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
            const answerTopic = topics.find((t) => t.id === answer.topicId);
            return (
              <div key={answer.questionId} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-start gap-2">
                    {answer.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{answerTopic?.title || "Topic"}</p>
                      <p className="mt-0.5 text-sm text-slate-100">{question?.question_text}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {answer.isBlindSpot && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-800 bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        <AlertTriangle className="h-3 w-3" /> Blind Spot
                      </span>
                    )}
                    {answer.isUncertainSuccess && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-sky-800 bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                        <Sparkles className="h-3 w-3" /> Underconfident Success
                      </span>
                    )}
                    {answer.isCorrect && answer.confidence === "high" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Aligned Mastery
                      </span>
                    )}
                    <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                      {(answer.score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid md:grid-cols-2 gap-3 text-[11px]">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-slate-500">Your answer</span>
                    <p className="mt-1 text-slate-200">{responses[answer.questionId] || "(empty)"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-slate-500">Model answer</span>
                    <p className="mt-1 text-slate-200">{answer.correctAnswer}</p>
                  </div>
                </div>

                {answer.rubricEvaluation && answer.rubricEvaluation.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {answer.rubricEvaluation.map((r) => (
                      <div key={r.keypoint} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px]">
                        <div>
                          <span className="font-semibold text-slate-200">{r.keypoint}</span>
                          <p className="mt-0.5 text-slate-500">{r.rationale}</p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded px-2 py-0.5 font-mono text-[10px]",
                            r.status === "met"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : r.status === "partially_met"
                              ? "bg-amber-950 text-amber-300 border border-amber-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          )}
                        >
                          {r.status.replace("_", " ")} · {(r.marks_awarded * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] leading-relaxed text-slate-300">
                  {answer.feedback}
                </p>

                <div className="mt-3">
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Take Another Assessment
            </button>
            <div className="flex gap-2">
              <Link href="/gap-report" className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                View Gap Report
              </Link>
              <Link href="/planner" className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-bold text-white">
                Open Revision Plan
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic AI Generator Preview Modal */}
      {showGeneratorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-cyan-700/80 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Dynamic AI Question Generator Output</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneratorModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/40 p-3 text-xs text-cyan-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Generated via <code className="font-mono text-cyan-300">/api/quiz/generate</code> grounded in Operating Systems course chunks.</span>
              </div>
              <span className="rounded bg-cyan-900/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-700">
                Zero-Leak Safe Projection
              </span>
            </div>

            <div className="space-y-4 text-left">
              {generatedQuestions && generatedQuestions.length > 0 ? (
                generatedQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono text-cyan-300">Question {idx + 1} • {q.topicTitle || "Operating Systems"}</span>
                      <span className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[10px] font-mono uppercase text-slate-300">
                        {q.questionType} • Difficulty {q.difficulty || 2}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">{q.questionText}</p>
                    {q.options && Array.isArray(q.options) && (
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt: any) => (
                          <div key={opt.id} className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2">
                            <span className="font-mono font-bold text-cyan-400">{opt.id}.</span>
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">No questions generated.</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGeneratorModal(false)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
