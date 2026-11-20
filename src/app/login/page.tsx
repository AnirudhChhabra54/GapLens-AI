"use client";

// ==============================================================================
// GapLens AI — Screen 1: Authentication & 1-Click Judge Demo Fast Track
// File: src/app/login/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and instant evaluation fast-track.
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
  ChevronLeft,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { supabase } from "@/lib/supabase/client";

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

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please provide both email and password.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (tab === "signup") {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: { full_name: name.trim() || email.split("@")[0] },
          },
        });
        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn("[Supabase Auth] Fallback notice:", err);
    }

    loginCustom(email.trim(), name.trim());
    setTimeout(() => {
      router.push("/dashboard");
    }, 150);
  };

  return (
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-[#00D6A0]/[0.04] rounded-full blur-[140px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0] mb-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
          <span>[ SYSTEM 01 / AUTHENTICATION GATEWAY ]</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
          Sign In to{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F1F7F4] via-[#B7FFE8] to-[#00D6A0]">
            GapLens AI
          </span>
        </h2>
        <p className="text-xs sm:text-sm text-[#A0ADA6]">
          See the gaps. Master what matters.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* =========================================================================
            JUDGE ACCELERATION: 1-CLICK DEMO CARD
            ========================================================================= */}
        <div className="rounded-2xl border border-[#00D6A0]/40 bg-[#0D1512]/95 p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 rounded-bl-xl bg-[#00D6A0] px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#080D0C]">
            Judge Recommended
          </div>

          <div className="flex items-center gap-3 mb-3.5">
            <span className="p-2 rounded-xl bg-[#00D6A0]/10 border border-[#00D6A0]/30 text-[#00D6A0]">
              <Zap className="h-5 w-5 text-[#00D6A0] fill-[#00D6A0]" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#F1F7F4]">1-Click Judge Demo Fast Track</h3>
              <p className="text-[11px] text-[#00D6A0] font-mono">0-Latency Instant Evaluation</p>
            </div>
          </div>

          <p className="text-xs text-[#A0ADA6] leading-relaxed mb-4">
            Pre-seeded with real Operating Systems (CS-301) course: 10 syllabus topics, 24 textbook chunks, diagnostic quizzes, historical attempts, and knapsack revision plan.
          </p>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#A0ADA6] mb-5 bg-[#080D0C]/80 p-3 rounded-xl border border-[#B7FFE8]/[0.08]">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#00D6A0]" />
              <span className="truncate">demo@gapfinder.ai</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-[#00D6A0]" />
              <span>13 DB Tables</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#00D6A0]" />
              <span>OS CS-301 Syllabus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-[#00D6A0]" />
              <span>Verified Citations</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handle1ClickJudgeDemo}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D6A0] hover:bg-[#00D6A0]/90 px-4 py-3 text-xs font-mono font-bold text-[#080D0C] shadow-lg shadow-[#00D6A0]/25 transition-all transform active:scale-[0.98]"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Launch 1-Click Judge Demo</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* =========================================================================
            STANDARD AUTH FORM
            ========================================================================= */}
        <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl backdrop-blur-md space-y-4">
          {/* Tabs */}
          <div className="flex rounded-xl bg-[#080D0C] p-1 border border-[#B7FFE8]/[0.08]">
            <button
              type="button"
              onClick={() => setTab("signin")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-mono font-semibold transition ${
                tab === "signin"
                  ? "bg-[#17231D] text-[#00D6A0] border border-[#00D6A0]/30 shadow-sm"
                  : "text-[#A0ADA6] hover:text-[#F1F7F4]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 rounded-lg py-1.5 text-xs font-mono font-semibold transition ${
                tab === "signup"
                  ? "bg-[#17231D] text-[#00D6A0] border border-[#00D6A0]/30 shadow-sm"
                  : "text-[#A0ADA6] hover:text-[#F1F7F4]"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-[#F87171]/10 border border-[#F87171]/40 p-3 text-xs text-[#F87171]">
              {error}
            </div>
          )}

          <form onSubmit={handleCustomSubmit} className="space-y-4">
            {tab === "signup" && (
              <div>
                <label className="block text-xs font-mono text-[#A0ADA6] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-[#6D7C74]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full rounded-xl border border-[#B7FFE8]/[0.1] bg-[#080D0C] pl-10 pr-3.5 py-2.5 text-xs text-[#F1F7F4] placeholder-[#6D7C74] focus:outline-none focus:border-[#00D6A0] focus:ring-1 focus:ring-[#00D6A0] transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-[#A0ADA6] mb-1">
                Student Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#6D7C74]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  required
                  className="w-full rounded-xl border border-[#B7FFE8]/[0.1] bg-[#080D0C] pl-10 pr-3.5 py-2.5 text-xs text-[#F1F7F4] placeholder-[#6D7C74] focus:outline-none focus:border-[#00D6A0] focus:ring-1 focus:ring-[#00D6A0] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[#A0ADA6] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-[#6D7C74]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl border border-[#B7FFE8]/[0.1] bg-[#080D0C] pl-10 pr-3.5 py-2.5 text-xs text-[#F1F7F4] placeholder-[#6D7C74] focus:outline-none focus:border-[#00D6A0] focus:ring-1 focus:ring-[#00D6A0] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#17231D] hover:bg-[#1f2f27] text-[#F1F7F4] border border-[#B7FFE8]/[0.15] font-mono font-semibold py-2.5 text-xs transition"
            >
              {tab === "signin" ? "Sign In to Workspace" : "Register New Account"}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs font-mono text-[#A0ADA6] hover:text-[#00D6A0] transition inline-flex items-center gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to Overview Landing</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
