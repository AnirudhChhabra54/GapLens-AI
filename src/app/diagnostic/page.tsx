"use client";

// ==============================================================================
// GapLens AI — Screen 4: Diagnostic Lab
// File: src/app/diagnostic/page.tsx
// Redesigned: Editorial light-first palette (warm ivory #F7F5F0, warm surface #FFFEFC,
// slate-blue #4C6477, warm clay #85553F, charcoal text #252A2E).
// Decoupled confidence capture, clean question typography, zero-leak rubric evaluation.
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
  HelpCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { CitationBadge } from "@/components/citation-badge";
import type { ConfidenceLevel } from "@/types/database";
import type { QuizEvaluationResponse } from "@/types/assessment";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";
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
    label: "Diagnostic screening",
    description: "Balanced screening across assessed syllabus topics.",
  },
  {
    id: "drill",
    label: "Topic drill",
    description: "Target focused micro-concepts with deep practice.",
  },
  {
    id: "retest",
    label: "Weak-topic retest",
    description: "Reassess low-mastery topics to update the Bayesian prior.",
  },
  {
    id: "exam",
    label: "Exam simulation",
    description: "High-weight multi-concept questions under standard rubric.",
  },
];

const CONFIDENCE_OPTIONS: Array<{ id: ConfidenceLevel; label: string; description: string }> = [
  { id: "low", label: "Low confidence", description: "Uncertain / educated guess" },
  { id: "medium", label: "Medium confidence", description: "Fairly sure of concept" },
  { id: "high", label: "High confidence", description: "Completely certain of answer" },
];

export default function DiagnosticPage() {
  const { workspace, topics, applyAssessmentResults, isDemo } = useWorkspace();
  const [mode, setMode] = useState<QuizMode>("diagnostic");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, ConfidenceLevel>>({});
  const [result, setResult] = useState<QuizEvaluationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // Dynamic AI question generator state & runner integration
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<any[] | null>(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeCustomQuestions, setActiveCustomQuestions] = useState<SafeQuestion[] | null>(null);

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
      setActiveQuizId(data.quizId || null);
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
    if (activeCustomQuestions && activeCustomQuestions.length > 0) {
      return activeCustomQuestions;
    }
    if (!isDemo) {
      return [];
    }
    if (mode === "retest" || mode === "drill") {
      const focused = SAFE_QUIZ_QUESTIONS.filter((q) => weakTopicIds.has(q.topic_id));
      return focused.length > 0 ? focused : SAFE_QUIZ_QUESTIONS;
    }
    return SAFE_QUIZ_QUESTIONS;
  }, [mode, weakTopicIds, activeCustomQuestions, isDemo]);

  const activeQuestion = questions[currentIndex];
  const topicTitle = useMemo(
    () => topics.find((t) => t.id === activeQuestion?.topic_id)?.title || "Course topic",
    [activeQuestion, topics]
  );

  const answeredCount = questions.filter(
    (q) => (responses[q.id] || "").trim().length > 0 && Boolean(confidence[q.id])
  ).length;
  const allAnswered = answeredCount === questions.length;
  const activeConfidence = activeQuestion ? confidence[activeQuestion.id] : undefined;

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
      setError("Please answer every question and select your confidence level before submitting.");
      return;
    }

    setLoading(true);
    setError(null);
    setPlanMessage(null);

    try {
      const payload = {
        quizId: activeQuizId || (isDemo ? DEMO_QUIZ_ID : crypto.randomUUID()),
        workspaceId: workspace?.id || DEMO_WORKSPACE_ID,
        answers: questions.map((q) => ({
          questionId: q.id,
          response: responses[q.id],
          confidence: confidence[q.id] || "medium",
          questionText: q.question_text,
          questionType: q.question_type,
          options: q.options,
          topicId: q.topic_id,
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
            const question =
              questions.find((q) => q.id === answer.questionId) ||
              SAFE_QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
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

  const activeModeInfo = MODES.find((m) => m.id === mode);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-brandBorder">
        <PageHeader
          title="Check your understanding"
          description="Answer questions based on your course material. Rate your confidence before your result is revealed."
        />

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={generateDynamicQuizPreview}
            disabled={generatingQuiz}
            className="shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>{generatingQuiz ? "Generating..." : "Preview AI Question Generator"}</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          COMPACT ASSESSMENT MODE SELECTOR
          ========================================================================= */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-control bg-surface-subtle border border-brandBorder text-xs">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => changeMode(m.id)}
              className={cn(
                "px-3 py-1.5 rounded-control transition-colors font-medium",
                mode === m.id
                  ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder font-semibold"
                  : "text-brandText-muted hover:text-brandText-primary border border-transparent"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brandText-muted px-1">
          {activeModeInfo?.description}
        </p>
      </div>

      {/* =========================================================================
          ASSESSMENT BODY: QUESTION VIEW OR RESULTS
          ========================================================================= */}
      {!result ? (
        questions.length === 0 ? (
          <div className="max-w-3xl mx-auto">
            <Card className="text-center py-12 px-6 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center text-accent">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base font-semibold text-brandText-primary">
                  No active diagnostic assessment
                </h3>
                <p className="text-xs text-brandText-secondary leading-relaxed">
                  Generate an AI diagnostic screening grounded in your course materials. Questions are dynamically created with grading rubrics and citation references.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  onClick={generateDynamicQuizPreview}
                  disabled={generatingQuiz}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{generatingQuiz ? "Generating questions..." : "Generate diagnostic screening"}</span>
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="space-y-6">
            {/* Header: Progress, topic, difficulty */}
            <div className="space-y-3 pb-4 border-b border-brandBorder">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium text-accent">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <span className="font-mono text-brandText-muted text-[11px] uppercase tracking-wider">
                  {activeQuestion?.question_type === "mcq" ? "Multiple choice" : "Short answer"}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`,
                  }}
                />
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs text-brandText-secondary">
                <BookOpen className="h-3.5 w-3.5 text-accent" />
                <span className="font-medium text-brandText-primary">{topicTitle}</span>
              </div>
            </div>

            {/* Question prompt */}
            <h2 className="text-base sm:text-lg font-medium leading-relaxed text-brandText-primary">
              {activeQuestion?.question_text}
            </h2>

            {/* Answer inputs */}
            <div className="space-y-3">
              {activeQuestion?.question_type === "mcq" && activeQuestion.options ? (
                activeQuestion.options.map((opt) => {
                  const isSelected = responses[activeQuestion.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setResponses((prev) => ({ ...prev, [activeQuestion.id]: opt.id }))
                      }
                      className={cn(
                        "w-full flex items-start gap-3.5 rounded-control border p-3.5 text-left text-xs transition-colors",
                        isSelected
                          ? "border-accent bg-accent-soft/30 ring-1 ring-accent text-brandText-primary"
                          : "border-brandBorder bg-surface text-brandText-primary hover:border-brandBorder-strong hover:bg-surface-subtle"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors",
                          isSelected
                            ? "border-accent bg-accent text-white"
                            : "border-brandBorder-strong bg-surface text-brandText-secondary"
                        )}
                      >
                        {opt.id}
                      </span>
                      <span className="leading-relaxed mt-0.5">{opt.text}</span>
                    </button>
                  );
                })
              ) : activeQuestion ? (
                <div className="space-y-1.5">
                  <label htmlFor="short-answer-input" className="text-xs font-medium text-brandText-secondary">
                    Your explanation:
                  </label>
                  <textarea
                    id="short-answer-input"
                    value={responses[activeQuestion.id] || ""}
                    onChange={(e) =>
                      setResponses((prev) => ({ ...prev, [activeQuestion.id]: e.target.value }))
                    }
                    rows={5}
                    placeholder="Explain the concept in your own words. The grading engine evaluates conceptual coverage against the course rubric, not exact verbatim phrasing."
                    className="w-full rounded-control border border-brandBorder bg-surface p-3 text-xs text-brandText-primary placeholder-brandText-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition leading-relaxed font-sans"
                  />
                </div>
              ) : null}
            </div>

            {/* Confidence capture widget */}
            <div className="rounded-card border border-brandBorder bg-surface-subtle p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-medium text-brandText-primary">
                <Brain className="h-4 w-4 text-accent" />
                <span>Rate your confidence before seeing the result</span>
              </div>
              <p className="text-[11px] text-brandText-muted leading-relaxed">
                Rating your confidence helps detect blind spots (high confidence, wrong answer) and calibration needs.
              </p>

              <div className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {CONFIDENCE_OPTIONS.map((c) => {
                  const isSelected = activeConfidence === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        activeQuestion &&
                        setConfidence((prev) => ({ ...prev, [activeQuestion.id]: c.id }))
                      }
                      className={cn(
                        "p-2.5 rounded-control border text-left transition-colors",
                        isSelected
                          ? "border-accent bg-accent text-white font-medium shadow-xs"
                          : "border-brandBorder bg-surface text-brandText-secondary hover:border-brandBorder-strong"
                      )}
                    >
                      <div className="text-xs font-semibold">{c.label}</div>
                      <div
                        className={cn(
                          "text-[10px] mt-0.5",
                          isSelected ? "text-white/80" : "text-brandText-muted"
                        )}
                      >
                        {c.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-control bg-[#FDF0EE] border border-[#F2C9BE] text-[#B84A39] text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Stepper Controls */}
            <div className="flex items-center justify-between gap-3 border-t border-brandBorder pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>

              <span className="text-[11px] font-mono text-brandText-muted">
                {answeredCount} of {questions.length} answered
              </span>

              {currentIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                >
                  <span>Next question</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  disabled={loading || !allAnswered}
                >
                  <span>{loading ? "Evaluating answers..." : "Submit assessment"}</span>
                  <Target className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </Card>

          {/* Supporting information disclosure */}
          <div className="border border-brandBorder rounded-card bg-surface p-4">
            <button
              type="button"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="w-full flex items-center justify-between text-xs font-medium text-brandText-secondary hover:text-brandText-primary text-left"
            >
              <span className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-accent" />
                <span>How this assessment works</span>
              </span>
              <span className="text-brandText-muted text-[11px] font-mono">
                {showHowItWorks ? "Hide details" : "Show details"}
              </span>
            </button>

            {showHowItWorks && (
              <div className="mt-3 pt-3 border-t border-brandBorder text-xs text-brandText-secondary space-y-2">
                <p>
                  <strong>Zero-Leak Architecture:</strong> Answer keys and rubric standards remain server-side until you submit your answers and confidence ratings.
                </p>
                <p>
                  <strong>Evidence Grounding:</strong> Questions and rubrics are directly anchored to verified excerpts from your uploaded course syllabus and notes.
                </p>
                <p>
                  <strong>Bayesian Calibration:</strong> Results update your mastery distribution and automatically prioritize corresponding micro-tasks in your revision plan.
                </p>
              </div>
            )}
          </div>
        </div>
        )
      ) : (
        /* =========================================================================
            EVALUATION RESULT SCREEN
            ========================================================================= */
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Summary metrics row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <span className="text-xs uppercase tracking-wider text-brandText-muted font-mono">
                Overall score
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-brandText-primary font-mono">
                  {result.percentage.toFixed(0)}%
                </span>
                <span className="text-xs text-brandText-muted font-mono">
                  ({result.totalScore.toFixed(1)} / {result.maxPossibleScore})
                </span>
              </div>
            </Card>

            <Card>
              <span className="text-xs uppercase tracking-wider text-brandText-muted font-mono">
                Identified blind spots
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-3xl font-semibold font-mono",
                    result.newBlindSpotsCount > 0 ? "text-[#B84A39]" : "text-accent"
                  )}
                >
                  {result.newBlindSpotsCount}
                </span>
                <span className="text-xs text-brandText-muted">high-confidence errors</span>
              </div>
            </Card>

            <Card>
              <span className="text-xs uppercase tracking-wider text-brandText-muted font-mono">
                Plan calibration
              </span>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-accent font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>{planMessage ? "Schedule updated" : "Plan verified"}</span>
              </div>
              <p className="mt-1 text-[11px] text-brandText-muted line-clamp-1">
                {planMessage || "Prior Bayesian weights updated."}
              </p>
            </Card>
          </div>

          {/* Question-by-question review cards */}
          <div className="space-y-4">
            {result.answers.map((answer) => {
              const question =
                questions.find((q) => q.id === answer.questionId) ||
                SAFE_QUIZ_QUESTIONS.find((q) => q.id === answer.questionId);
              const answerTopic = topics.find((t) => t.id === answer.topicId);
              return (
                <Card key={answer.questionId} className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-brandBorder">
                    <div className="flex items-start gap-3">
                      {answer.isCorrect ? (
                        <div className="p-1 rounded-full bg-status-successSoft text-status-success shrink-0 mt-0.5">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-full bg-[#FDF0EE] text-[#B84A39] shrink-0 mt-0.5">
                          <XCircle className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-mono text-accent font-medium">
                          {answerTopic?.title || "Topic"}
                        </span>
                        <h4 className="mt-0.5 text-sm font-medium text-brandText-primary leading-relaxed">
                          {question?.question_text}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {answer.isBlindSpot && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#E8CFC4] bg-[#FAF2EE] px-2.5 py-0.5 text-[10px] font-mono font-medium text-[#85553F]">
                          <AlertTriangle className="h-3 w-3" /> Blind spot
                        </span>
                      )}
                      {answer.isUncertainSuccess && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brandBorder bg-surface-subtle px-2.5 py-0.5 text-[10px] font-mono text-brandText-secondary">
                          Underconfident correct
                        </span>
                      )}
                      <span className="rounded-control bg-surface-subtle border border-brandBorder px-2 py-0.5 font-mono text-xs text-brandText-primary font-medium">
                        {(answer.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-control border border-brandBorder bg-surface-subtle p-3 space-y-1">
                      <span className="text-brandText-muted text-[10px] uppercase font-mono tracking-wider block">
                        Your answer:
                      </span>
                      <p className="text-brandText-primary">
                        {responses[answer.questionId] || "(No response)"}
                      </p>
                    </div>

                    <div className="rounded-control border border-brandBorder bg-surface-subtle p-3 space-y-1">
                      <span className="text-accent text-[10px] uppercase font-mono tracking-wider block">
                        Reference key:
                      </span>
                      <p className="text-brandText-primary">{answer.correctAnswer}</p>
                    </div>
                  </div>

                  {answer.rubricEvaluation && answer.rubricEvaluation.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {answer.rubricEvaluation.map((r) => (
                        <div
                          key={r.keypoint}
                          className="flex items-start justify-between gap-3 rounded-control border border-brandBorder bg-surface p-2.5 text-xs"
                        >
                          <div>
                            <span className="font-medium text-brandText-primary block">{r.keypoint}</span>
                            <p className="mt-0.5 text-brandText-secondary text-[11px]">{r.rationale}</p>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-medium",
                              r.status === "met"
                                ? "bg-accent-soft text-accent"
                                : r.status === "partially_met"
                                ? "bg-[#FEF5E7] text-[#C27803]"
                                : "bg-[#FDF0EE] text-[#B84A39]"
                            )}
                          >
                            {r.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="p-3 rounded-control border border-brandBorder bg-surface text-xs leading-relaxed text-brandText-secondary">
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
                </Card>
              );
            })}
          </div>

          {/* Bottom navigation bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-card border border-brandBorder bg-surface">
            <Button variant="secondary" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Take another assessment</span>
            </Button>

            <div className="flex items-center gap-2">
              <Link href="/gap-report">
                <Button variant="secondary">
                  <span>View Gap Report</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/planner">
                <Button variant="primary">
                  <span>Open study plan</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic AI Generator Preview Modal */}
      {showGeneratorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-card border border-brandBorder bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-brandBorder pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-brandText-primary">
                  AI Question Generator Telemetry
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGeneratorModal(false)}
                className="rounded-control p-1 text-brandText-muted hover:text-brandText-primary transition"
                aria-label="Close generator modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-control border border-brandBorder bg-surface-subtle p-3 text-xs text-brandText-secondary flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
                <span>
                  Generated via <code className="font-mono text-accent">/api/quiz/generate</code> grounded in indexed course chunks.
                </span>
              </div>
              <span className="rounded px-2 py-0.5 text-[10px] font-mono text-accent bg-accent-soft border border-[#C8D6DE] shrink-0">
                Zero-Leak Projection
              </span>
            </div>

            <div className="space-y-3 text-left">
              {generatedQuestions && generatedQuestions.length > 0 ? (
                generatedQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="rounded-control border border-brandBorder bg-surface-subtle p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-brandText-secondary">
                      <span className="font-mono text-accent">
                        Question {idx + 1} • {q.topicTitle || "Operating Systems"}
                      </span>
                      <span className="rounded bg-surface border border-brandBorder px-2 py-0.5 text-[10px] font-mono uppercase text-brandText-muted">
                        {q.questionType} • Difficulty {q.difficulty || 2}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-brandText-primary leading-relaxed">
                      {q.questionText}
                    </p>
                    {q.options && Array.isArray(q.options) && (
                      <div className="space-y-1.5 pt-1">
                        {q.options.map((opt: any) => (
                          <div
                            key={opt.id}
                            className="rounded-control border border-brandBorder bg-surface px-3 py-1.5 text-xs text-brandText-secondary flex items-center gap-2"
                          >
                            <span className="font-mono font-medium text-accent">{opt.id}.</span>
                            <span>{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-brandText-muted py-4 text-center">No questions generated.</p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowGeneratorModal(false)}>
                Close Preview
              </Button>
              {generatedQuestions && generatedQuestions.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const mapped: SafeQuestion[] = generatedQuestions.map((g) => ({
                      id: g.id,
                      topic_id: g.topicId,
                      question_type: g.questionType,
                      question_text: g.questionText,
                      options: g.options,
                    }));
                    setActiveCustomQuestions(mapped);
                    reset();
                    setShowGeneratorModal(false);
                  }}
                >
                  <span>Start this diagnostic quiz</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
