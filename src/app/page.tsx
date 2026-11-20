"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  Search,
  Target,
  BarChart2,
  Calendar,
  Layers,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { StatusBadge, Button } from "@/components/ui/design-system";

export default function HomePage() {
  const router = useRouter();
  const { loginAsDemo } = useWorkspace();
  return (
    <div className="bg-canvas text-brandText-primary">
      {/* 1. Hero Section */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-brandBorder overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Headline and Call to Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-brandBorder bg-surface-subtle text-xs font-medium text-brandText-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Evidence-Grounded Study Diagnosis</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-brandText-primary leading-[1.12]">
                See the gaps. <br className="hidden sm:inline" />
                <span className="text-accent font-serif italic">Master what matters.</span>
              </h1>

              <p className="text-base sm:text-lg text-brandText-secondary leading-relaxed max-w-xl">
                Understand what you actually know, uncover the blind spots you only think you understand,
                and focus your limited revision time directly where it impacts exam performance.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    loginAsDemo();
                    router.push("/dashboard");
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-card bg-accent hover:bg-accent-hover text-white text-sm font-semibold shadow-subtle transition-all cursor-pointer"
                >
                  <span>Demo</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <Link
                  href="/login?mode=signup"
                  className="inline-flex items-center justify-center px-5 py-3 rounded-card bg-surface hover:bg-surface-subtle border border-brandBorder text-sm font-medium text-brandText-primary transition-colors"
                >
                  Create account
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-brandText-secondary hover:text-brandText-primary transition-colors"
                >
                  Explore how it works
                </a>
              </div>

              <div className="pt-4 flex items-center gap-6 text-xs text-brandText-muted">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-status-success" />
                  <span>Pre-seeded OS CS-301 curriculum</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-status-success" />
                  <span>Verified textbook citations</span>
                </div>
              </div>
            </div>

            {/* Right Column: Genuine Product Diagnostic Excerpt */}
            <div className="lg:col-span-5">
              <div className="rounded-panel border border-brandBorder bg-surface p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-brandBorder">
                  <div>
                    <span className="text-[11px] font-semibold text-brandText-muted uppercase tracking-wider block">
                      Diagnostic Sample
                    </span>
                    <span className="text-sm font-semibold text-brandText-primary">
                      Operating Systems (CS-301)
                    </span>
                  </div>
                  <StatusBadge variant="warning" label="High-confidence mistake" />
                </div>

                {/* Evidence Diagnostic Card */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-brandText-primary">
                    Q: Why does Peterson&apos;s algorithm fail on modern superscalar CPUs?
                  </div>

                  <div className="p-3 rounded-card bg-surface-subtle text-xs text-brandText-secondary space-y-1.5 border border-brandBorder">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-status-danger font-medium">Student Answer: &ldquo;Busy waiting causes priority inversion&rdquo;</span>
                      <span className="text-brandText-muted">Confidence: High</span>
                    </div>
                    <div className="text-[11px] text-brandText-muted">
                      Diagnosis: Student confidently mistook algorithmic busy waiting for hardware memory reordering.
                    </div>
                  </div>

                  {/* Grounded Citation */}
                  <div className="p-3 rounded-card bg-[#F9F7F2] border border-brandBorder-strong text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-accent font-medium text-[11px]">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Silberschatz OS Concepts, pp. 22–23</span>
                    </div>
                    <p className="text-[11px] text-brandText-secondary italic leading-relaxed">
                      &ldquo;Without explicit memory barriers (fences), out-of-order execution allows store-load reordering, breaking mutual exclusion.&rdquo;
                    </p>
                  </div>
                </div>

                {/* Suggested Action */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-brandText-muted">Allocated revision: 15 min review</span>
                  <span className="text-accent font-medium">Scheduled for Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 border-b border-brandBorder bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider block">
              Systematic Method
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brandText-primary">
              How GapLens diagnoses your understanding
            </h2>
            <p className="text-sm sm:text-base text-brandText-secondary leading-relaxed">
              Rather than passively waiting for prompts or generating unverified responses, GapLens runs
              an active diagnosis loop grounded in course textbooks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 space-y-3 shadow-subtle">
              <div className="h-8 w-8 rounded-card bg-surface-subtle border border-brandBorder flex items-center justify-center text-xs font-semibold text-accent">
                01
              </div>
              <h3 className="text-base font-semibold text-brandText-primary">
                Ingest & Map Materials
              </h3>
              <p className="text-xs text-brandText-secondary leading-relaxed">
                Lecture notes, syllabus documents, and past exam papers are parsed with page metadata,
                chunked with semantic headings, and organized into an explicit prerequisite graph.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 space-y-3 shadow-subtle">
              <div className="h-8 w-8 rounded-card bg-surface-subtle border border-brandBorder flex items-center justify-center text-xs font-semibold text-accent">
                02
              </div>
              <h3 className="text-base font-semibold text-brandText-primary">
                Calibrate Confidence
              </h3>
              <p className="text-xs text-brandText-secondary leading-relaxed">
                Diagnostic questions test conceptual depth. Students record their confidence before
                seeing scores, allowing the Bayesian model to separate genuine mastery from confident misconceptions.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 space-y-3 shadow-subtle">
              <div className="h-8 w-8 rounded-card bg-surface-subtle border border-brandBorder flex items-center justify-center text-xs font-semibold text-accent">
                03
              </div>
              <h3 className="text-base font-semibold text-brandText-primary">
                Plan Realistic Revision
              </h3>
              <p className="text-xs text-brandText-secondary leading-relaxed">
                A knapsack scheduler prioritizes weak prerequisite topics, packing tasks into your chosen
                daily study minutes so you never face an unmanageable queue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Pillars / Architecture */}
      <section className="py-16 sm:py-24 border-b border-brandBorder bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider block">
              Core Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brandText-primary">
              Built on academic evidence, not AI hallucinations
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 sm:p-8 space-y-4 shadow-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-card bg-accent-soft text-accent">
                  <Search className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-brandText-primary">
                  Strict Source-Grounded Citations
                </h3>
              </div>
              <p className="text-sm text-brandText-secondary leading-relaxed">
                Every diagnostic question, grading feedback, and study assistant explanation is anchored
                directly to retrieved textbook excerpts. When evidence is insufficient, the system abstains
                rather than inventing plausible-sounding claims.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 sm:p-8 space-y-4 shadow-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-card bg-warm-soft text-warm">
                  <Target className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-brandText-primary">
                  Blind Spot Discovery
                </h3>
              </div>
              <p className="text-sm text-brandText-secondary leading-relaxed">
                Exam failure rarely comes from questions students knew they could not answer. It comes from
                high-confidence errors. GapLens surfaces these discrepancies so you can correct false assumptions
                before the test.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 sm:p-8 space-y-4 shadow-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-card bg-status-successSoft text-status-success">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-brandText-primary">
                  Prerequisite Dependency Tracking
                </h3>
              </div>
              <p className="text-sm text-brandText-secondary leading-relaxed">
                Concepts do not exist in isolation. You cannot understand distributed deadlocks without
                concurrency primitives. The topological topic graph ensures foundational gaps are addressed
                before downstream topics.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-panel border border-brandBorder bg-surface p-6 sm:p-8 space-y-4 shadow-subtle">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-card bg-accent-soft text-accent">
                  <Clock className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-brandText-primary">
                  Constrained Study Time Budget
                </h3>
              </div>
              <p className="text-sm text-brandText-secondary leading-relaxed">
                Tell GapLens you have 45 minutes today. The knapsack scheduler selects the highest-yield tasks
                and defers lower-priority work, preventing revision fatigue and procrastination.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Demo CTA Section */}
      <section className="py-16 sm:py-24 bg-surface text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-brandText-primary">
            Ready to explore the learning workspace?
          </h2>
          <p className="text-sm sm:text-base text-brandText-secondary leading-relaxed max-w-xl mx-auto">
            Explore the live Operating Systems (CS-301) course map, diagnostic evaluations, and adaptive study schedule with zero setup required.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                loginAsDemo();
                router.push("/dashboard");
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-card bg-accent hover:bg-accent-hover text-white text-sm font-semibold shadow-subtle transition-all cursor-pointer"
            >
              <span>Demo</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center justify-center px-5 py-3 rounded-card bg-surface hover:bg-surface-subtle border border-brandBorder text-sm font-medium text-brandText-primary transition-colors"
            >
              Create account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
