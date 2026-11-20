"use client";

// ==============================================================================
// GapLens AI — Screen 1: Authentication & 1-Click Judge Demo Fast Track
// File: src/app/login/page.tsx
// Provides email/password login and instant 1-Click Judge Demo authentication.
// ==============================================================================

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Database,
  Layers,
  FileCheck,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";

export default function LoginPage() {
  const router = useRouter();
  const { loginAsDemo, loginCustom } = useWorkspace();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle1ClickJudgeDemo = () => {
    setLoading(true);
    loginAsDemo();
    setTimeout(() => {
      router.push("/dashboard");
    }, 150);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please provide both email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    loginCustom(email, name);
    setTimeout(() => {
      router.push("/dashboard");
    }, 200);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#0B0F19] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-teal-500/5 blur-3xl pointer-events-none -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-blue-600 p-0.5 shadow-xl shadow-cyan-500/20 items-center justify-center mb-4">
          <Sparkles className="h-6 w-6 text-slate-950" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Sign In to GapLens AI
        </h2>
        <p className="mt-2 text-xs text-slate-400">
          See the gaps. Master what matters.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* =========================================================================
            JUDGE ACCELERATION: 1-CLICK DEMO CARD
            ========================================================================= */}
        <div className="rounded-2xl border-2 border-cyan-500/60 bg-gradient-to-b from-cyan-950/40 via-slate-900/95 to-slate-900/90 p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 rounded-bl-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
            Judge Recommended
          </div>

          <div className="flex items-center gap-2.5 mb-3">
            <span className="p-2 rounded-xl bg-cyan-950 border border-cyan-700/60 text-cyan-300">
              <Zap className="h-5 w-5 text-amber-300 fill-amber-300" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">1-Click Judge Demo Fast Track</h3>
              <p className="text-[11px] text-cyan-400 font-mono">0-Latency Instant Evaluation</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Pre-seeded with real Operating Systems (CS-301) course: 10 topics, 24 textbook chunks, diagnostic quizzes, historical attempts, and active revision plan.
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mb-5 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>demo@gapfinder.ai</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              <span>13 Database Tables</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <span>OS CS-301 Syllabus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Verified Citations</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handle1ClickJudgeDemo}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-blue-500 transition-all transform active:scale-95"
          >
            <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
            <span>Launch 1-Click Judge Demo</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* =========================================================================
            STANDARD AUTH FORM
            ========================================================================= */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-950 p-1 mb-5 border border-slate-800">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                tab === "signin"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                tab === "signup"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-950/40 border border-red-800/80 p-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleCustomSubmit} className="space-y-4">
            {tab === "signup" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Student Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 text-xs border border-slate-700 shadow transition"
            >
              {tab === "signin" ? "Sign In to Workspace" : "Register New Account"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-[11px] text-slate-400 hover:text-cyan-400 transition"
            >
              ← Back to Overview Landing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
