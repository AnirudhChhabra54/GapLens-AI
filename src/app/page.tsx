"use client";

// ==============================================================================
// GapLens AI — Hero Landing Page & 1-Click Judge Demo Launcher
// Branding: "GapLens AI — See the gaps. Master what matters."
// ==============================================================================

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Search,
  Scale,
  Calendar,
  MessageSquareCode,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";

export default function HomePage() {
  const router = useRouter();
  const { loginAsDemo, isLoggedIn } = useWorkspace();

  const handle1ClickJudgeDemo = () => {
    loginAsDemo();
    router.push("/dashboard");
  };

  return (
    <div className="relative overflow-hidden bg-[#0B0F19] text-slate-100">
      {/* Background glowing ambient gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
        {/* Hackathon Judge Pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-lg shadow-cyan-500/10 mb-8 backdrop-blur-md">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>Autonomous Academic Intelligence Engine</span>
          <span className="text-slate-500">•</span>
          <span className="font-mono text-emerald-400">Pre-Seeded OS CS-301 Workspace Ready</span>
        </div>

        {/* Main Headline & Tagline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          See the gaps. <br />
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
            Master what matters.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          The RAG-grounded syllabus diagnostic platform that uncovers high-confidence blind spots,
          pins every question to textbook citations, and builds greedy time-budgeted revision schedules.
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={handle1ClickJudgeDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all transform hover:-translate-y-0.5"
          >
            <Zap className="h-5 w-5 text-amber-300 fill-amber-300" />
            <span>1-Click Judge Demo</span>
            <ArrowRight className="h-5 w-5" />
          </button>

          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-4 text-base font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
          >
            Custom Sign In
          </Link>
        </div>

        {/* Quick evaluation note */}
        <p className="mt-4 text-xs text-slate-400 font-mono">
          ⚡ Judge Fast-Track: Instantly authenticates as <span className="text-cyan-400">demo@gapfinder.ai</span> with Operating Systems (CS-301).
        </p>

        {/* Live Mini Preview Metric Bar */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="flex items-center gap-3">
            <RadialProgress value={74} size={54} strokeWidth={6} />
            <div>
              <span className="text-xl font-bold text-white">74%</span>
              <p className="text-[11px] text-slate-400">Exam Readiness</p>
            </div>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <span className="text-xl font-bold text-cyan-400">10 Topics</span>
            <p className="text-[11px] text-slate-400">Grounded Hierarchy</p>
            <span className="text-[10px] text-emerald-400 font-medium">80% Assessed</span>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <span className="text-xl font-bold text-rose-400">1 Blind Spot</span>
            <p className="text-[11px] text-slate-400">High Confidence</p>
            <span className="text-[10px] text-rose-300 font-medium">TLB & Page Tables</span>
          </div>

          <div className="border-l border-slate-800 pl-4">
            <span className="text-xl font-bold text-blue-400">60 mins/day</span>
            <p className="text-[11px] text-slate-400">Revision Budget</p>
            <span className="text-[10px] text-cyan-400 font-medium">14 Days to Final</span>
          </div>
        </div>
      </section>

      {/* 6 Architectural Pillars Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Built on Rigorous Academic Engineering
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Every feature is backed by transparent mathematics, verified textbook citations, and deterministic constraints.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. Hybrid RRF RAG */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-cyan-950 border border-cyan-800/80 text-cyan-400 flex items-center justify-center mb-4">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">1. Hybrid Reciprocal Rank Fusion</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Combines 768-dimensional Gemini dense vector embeddings (HNSW cosine) with PostgreSQL GIN keyword full-text search ($k=60$).
            </p>
          </div>

          {/* 2. Bayesian Mastery Math */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-blue-950 border border-blue-800/80 text-blue-400 flex items-center justify-center mb-4">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">2. Bayesian Exponential Decay</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Tracks genuine concept retention using Bayesian decay math ($\gamma=0.80, \mu_0=0.45, k=1.2$) across foundation, standard, and advanced questions.
            </p>
          </div>

          {/* 3. Blind Spot Calibration */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-rose-950 border border-rose-800/80 text-rose-400 flex items-center justify-center mb-4">
              <Scale className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">3. Decoupled Confidence & Blind Spots</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Decouples self-reported confidence (Low, Medium, High) from correctness to uncover hazardous high-confidence blind spots and imposter syndrome.
            </p>
          </div>

          {/* 4. Verified Citations */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-emerald-950 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">4. Deterministic Citation Pinning</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Citation metadata is pinned from database chunks—never hallucinated by generative models. Whitespace-normalized verification ensures text authenticity.
            </p>
          </div>

          {/* 5. Greedy Time-Budget Scheduler */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-amber-950 border border-amber-800/80 text-amber-400 flex items-center justify-center mb-4">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">5. Time-Budgeted Revision Planner</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Multi-factor priority scoring greedily packs tasks so every day stays within the configured daily-minute budget.
            </p>
          </div>

          {/* 6. Grounded Study Copilot */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-cyan-500/40 transition">
            <div className="h-10 w-10 rounded-lg bg-purple-950 border border-purple-800/80 text-purple-400 flex items-center justify-center mb-4">
              <MessageSquareCode className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white">6. Source-Locked Study Copilot</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Answers strictly from course chunks with verified citations, complete prompt-injection defense, and transparent out-of-scope refusals.
            </p>
          </div>
        </div>
      </section>

      {/* Direct Screen Navigation Grid for Evaluators */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 border-t border-slate-800/80 bg-slate-950/40">
        <div className="text-center mb-8">
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            Autonomous Evaluation Access
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">Direct Screen Navigator</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: "1. Login / Demo", href: "/login", desc: "Auth & 1-Click Fast Track" },
            { name: "2. Dashboard", href: "/dashboard", desc: "Readiness & Coverage" },
            { name: "3. Materials", href: "/materials", desc: "Upload & Prereq DAG" },
            { name: "4. Diagnostic", href: "/diagnostic", desc: "Runner & Rubrics" },
            { name: "5. Gap Report", href: "/gap-report", desc: "Hero Mastery Matrix" },
            { name: "6. Planner", href: "/planner", desc: "Schedule & Copilot" },
          ].map((screen, idx) => (
            <Link
              key={idx}
              href={screen.href}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-200">{screen.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1">{screen.desc}</p>
              </div>
              <div className="mt-3 flex items-center gap-1 text-[10px] text-cyan-400 font-medium">
                <span>Open Screen</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
