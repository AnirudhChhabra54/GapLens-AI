"use client";

// ==============================================================================
// GapLens AI — Authentication & Demo Gateway
// File: src/app/login/page.tsx
// Supports Sign In, Create Account, and 1-Click Demo Workspace access.
// Light-first editorial styling with warm ivory canvas and clean form controls.
// ==============================================================================

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { loginCustom, loginAsDemo } = useWorkspace();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup") {
        setTab("signup");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please provide both email and password.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (tab === "signup") {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: { full_name: name.trim() || email.split("@")[0] },
          },
        });

        if (authError) {
          setError(authError.message);
          return;
        }

        if (!signUpData.session) {
          setError("Account created. Check your email to confirm it, then sign in.");
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (authError) {
          setError(authError.message);
          return;
        }
      }

      await loginCustom(email.trim(), name.trim());
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-canvas flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-control bg-accent flex items-center justify-center text-white shadow-subtle">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-semibold text-xl tracking-tight text-brandText-primary">
              GapLens AI
            </span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-brandText-primary pt-2">
            {tab === "signup" ? "Create your account" : "Sign in to workspace"}
          </h1>
          <p className="text-sm text-brandText-secondary">
            {tab === "signup"
              ? "Register to start diagnosing and mastering course gaps."
              : "Access your course maps, diagnostics, and study plan."}
          </p>
        </div>

        {/* Authentication Card */}
        <div className="rounded-panel border border-brandBorder bg-surface p-6 sm:p-8 shadow-card space-y-5">
          {/* Instant 1-Click Demo Entry */}
          <div>
            <button
              type="button"
              onClick={() => {
                loginAsDemo();
                router.push("/dashboard");
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control bg-accent hover:bg-accent-hover text-white text-sm font-semibold shadow-subtle transition-all"
            >
              <span>Explore Demo Workspace (No Login Required)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-brandBorder"></div>
            <span className="flex-shrink mx-3 text-xs text-brandText-muted font-mono uppercase">
              or continue below
            </span>
            <div className="flex-grow border-t border-brandBorder"></div>
          </div>

          {/* Tab Switcher: Sign In vs Create Account */}
          <div className="flex p-1 rounded-control bg-surface-subtle border border-brandBorder text-xs">
            <button
              type="button"
              onClick={() => {
                setTab("signin");
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-control font-medium transition-colors ${
                tab === "signin"
                  ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder font-semibold"
                  : "text-brandText-muted hover:text-brandText-primary border border-transparent"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-control font-medium transition-colors ${
                tab === "signup"
                  ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder font-semibold"
                  : "text-brandText-muted hover:text-brandText-primary border border-transparent"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-card bg-status-dangerSoft border border-[#E4C9C7] p-3 text-xs text-status-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field (Sign Up only) */}
            {tab === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-brandText-primary mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-brandText-muted" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Chen"
                    className="w-full rounded-control border border-brandBorder bg-surface pl-9 pr-3.5 py-2 text-sm text-brandText-primary placeholder:text-brandText-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold text-brandText-primary mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-brandText-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  required
                  autoFocus={tab === "signin"}
                  className="w-full rounded-control border border-brandBorder bg-surface pl-9 pr-3.5 py-2 text-sm text-brandText-primary placeholder:text-brandText-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-brandText-primary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-brandText-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-control border border-brandBorder bg-surface pl-9 pr-10 py-2 text-sm text-brandText-primary placeholder:text-brandText-muted focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-brandText-muted hover:text-brandText-secondary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-control bg-accent hover:bg-accent-hover text-white text-sm font-semibold shadow-subtle transition-all disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {loading ? (
                <span>{tab === "signup" ? "Creating account..." : "Signing in..."}</span>
              ) : (
                <>
                  <span>{tab === "signup" ? "Create Account" : "Sign in to workspace"}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between modes */}
          <div className="pt-2 text-center text-xs text-brandText-secondary">
            {tab === "signup" ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("signin");
                    setError(null);
                  }}
                  className="font-semibold text-accent hover:underline"
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setTab("signup");
                    setError(null);
                  }}
                  className="font-semibold text-accent hover:underline"
                >
                  Create account
                </button>
              </span>
            )}
          </div>

          <div className="pt-2 text-center border-t border-brandBorder">
            <Link
              href="/"
              className="text-xs text-brandText-secondary hover:text-accent font-medium inline-flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to overview</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
