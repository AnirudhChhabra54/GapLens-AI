"use client";

// ==============================================================================
// GapLens AI — Hero Landing Page & 1-Click Judge Demo Launcher
// Branding: "GapLens AI — See the gaps. Master what matters."
// Visual Style: Dark, cinematic atmosphere, emerald lighting, editorial typography.
// ==============================================================================

import React, { useEffect, useRef } from "react";
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
  Layers,
  Clock,
  BookOpen,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { RadialProgress } from "@/components/radial-progress";

export default function HomePage() {
  const router = useRouter();
  const { loginAsDemo, isLoggedIn } = useWorkspace();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handle1ClickJudgeDemo = () => {
    loginAsDemo();
    router.push("/dashboard");
  };

  // Interactive 3D Knowledge Lattice Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Knowledge Node Network representation
    const nodes: {
      x: number;
      y: number;
      z: number;
      label: string;
      color: string;
      size: number;
    }[] = [
      { x: 0, y: 0, z: 0, label: "Operating Systems", color: "#00D6A0", size: 8 },
      { x: -140, y: -70, z: 60, label: "Virtual Memory", color: "#F87171", size: 6 },
      { x: 130, y: -80, z: -40, label: "CPU Scheduling", color: "#00D6A0", size: 6 },
      { x: -110, y: 80, z: -50, label: "Peterson's Algorithm", color: "#F87171", size: 6 },
      { x: 120, y: 70, z: 70, label: "Deadlock Avoidance", color: "#FBBF24", size: 6 },
      { x: 0, y: -130, z: -30, label: "Memory Hierarchy", color: "#B7FFE8", size: 5 },
      { x: -180, y: 20, z: 20, label: "Page Tables", color: "#00D6A0", size: 5 },
      { x: 180, y: -10, z: 10, label: "Banker's Algorithm", color: "#FBBF24", size: 5 },
      { x: 0, y: 140, z: 40, label: "File Systems", color: "#B7FFE8", size: 5 },
    ];

    let angleY = 0;
    let angleX = 0.2;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left - width / 2) * 0.0005;
      mouseY = (e.clientY - rect.top - height / 2) * 0.0005;
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      angleY += 0.004 + mouseX;
      angleX += (mouseY - angleX) * 0.05;

      const fov = 350;
      const projectedNodes: { x: number; y: number; scale: number; color: string; label: string; size: number }[] = [];

      // Rotate and project nodes
      nodes.forEach((node) => {
        // Rotate around Y axis
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        const x1 = node.x * cosY - node.z * sinY;
        const z1 = node.z * cosY + node.x * sinY;

        // Rotate around X axis
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        const y2 = node.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + node.y * sinX;

        const depth = z2 + 380;
        const scale = fov / Math.max(10, depth);
        const projX = width / 2 + x1 * scale;
        const projY = height / 2 + y2 * scale;

        projectedNodes.push({
          x: projX,
          y: projY,
          scale,
          color: node.color,
          label: node.label,
          size: node.size * scale,
        });
      });

      // Draw connection edges
      ctx.lineWidth = 1;
      for (let i = 0; i < projectedNodes.length; i++) {
        for (let j = i + 1; j < projectedNodes.length; j++) {
          const dx = projectedNodes[i].x - projectedNodes[j].x;
          const dy = projectedNodes[i].y - projectedNodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.28;
            ctx.strokeStyle = `rgba(0, 214, 160, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projectedNodes[i].x, projectedNodes[i].y);
            ctx.lineTo(projectedNodes[j].x, projectedNodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw Pedestal Glow ring at bottom center
      const gradient = ctx.createRadialGradient(width / 2, height - 30, 10, width / 2, height - 30, 220);
      gradient.addColorStop(0, "rgba(0, 214, 160, 0.25)");
      gradient.addColorStop(0.5, "rgba(0, 214, 160, 0.08)");
      gradient.addColorStop(1, "rgba(8, 13, 12, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(width / 2, height - 30, 200, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw nodes
      projectedNodes.forEach((p) => {
        // Outer halo
        ctx.fillStyle = p.color === "#00D6A0" ? "rgba(0, 214, 160, 0.2)" : "rgba(248, 113, 113, 0.2)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, p.size), 0, Math.PI * 2);
        ctx.fill();

        // Node label
        if (p.scale > 0.8) {
          ctx.fillStyle = "rgba(241, 247, 244, 0.85)";
          ctx.font = `${Math.round(10 * p.scale)}px "SF Mono", monospace`;
          ctx.textAlign = "center";
          ctx.fillText(p.label, p.x, p.y + p.size + 14);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="relative overflow-hidden bg-[#080D0C] text-[#F1F7F4]">
      {/* Top subtle emerald lighting ambiance */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-[radial-gradient(circle_at_50%_0%,rgba(0,214,160,0.12)_0%,rgba(8,13,12,0)_70%)] pointer-events-none -z-10" />

      {/* =========================================================================
          HERO SECTION
          ========================================================================= */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-24 text-center">
        {/* System telemetry pill */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-[rgba(183,255,232,0.14)] bg-[#0D1512] px-4 py-1.5 text-[11px] font-mono text-[#A0ADA6] shadow-[0_0_20px_rgba(0,214,160,0.1)] mb-8 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
          <span className="text-[#00D6A0] uppercase font-bold tracking-wider">SYSTEM 01 / INTELLIGENCE</span>
          <span className="text-[#6D7C74]">|</span>
          <span className="text-[#F1F7F4]">Pre-Seeded OS CS-301 Ready</span>
        </div>

        {/* Display Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[#F1F7F4] max-w-4xl mx-auto leading-tight uppercase">
          SEE THE GAPS. <br />
          <span className="text-mint-gradient italic font-serif normal-case">
            master what matters.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#A0ADA6] max-w-2xl mx-auto leading-relaxed">
          Know what you understand. Discover what you are missing. Spend your study time where it makes the biggest difference.
        </p>

        {/* Primary Call-to-Actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={handle1ClickJudgeDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#00D6A0] to-[#00B887] px-8 py-4 text-sm font-bold text-[#080D0C] shadow-[0_0_30px_rgba(0,214,160,0.3)] hover:shadow-[0_0_40px_rgba(0,214,160,0.5)] transition-all transform hover:-translate-y-0.5"
          >
            <span>Enter Your Workspace</span>
            <span className="h-6 w-6 rounded-full bg-[#080D0C] text-[#00D6A0] flex items-center justify-center">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(183,255,232,0.14)] bg-[#0D1512] px-7 py-4 text-sm font-semibold text-[#F1F7F4] hover:bg-[#121D18] hover:border-[#00D6A0]/40 transition"
          >
            Explore the Platform
          </a>
        </div>

        <p className="mt-4 text-xs font-mono text-[#6D7C74]">
          Fast-Track: Instantly authenticates as <span className="text-[#00D6A0]">demo@gapfinder.ai</span> into Operating Systems (CS-301).
        </p>

        {/* Interactive Knowledge Lattice Visual */}
        <div className="mt-12 relative w-full max-w-4xl mx-auto h-[380px] sm:h-[440px] rounded-3xl border border-[rgba(183,255,232,0.10)] bg-[#0D1512]/80 backdrop-blur-2xl overflow-hidden shadow-2xl flex flex-col items-center justify-center">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Overlay HUD Telemetry Header */}
          <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-[11px] font-mono text-[#A0ADA6] pointer-events-none">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00D6A0] animate-ping" />
              <span className="text-[#F1F7F4] font-semibold">KNOWLEDGE LATTICE / LIVE TOPOLOGY</span>
            </div>
            <span className="hidden sm:inline text-[#6D7C74]">DRAG TO ROTATE 3D LATTICE</span>
          </div>

          {/* Overlay HUD Telemetry Footer (Real Workspace Values) */}
          <div className="absolute bottom-4 left-5 right-5 bg-[#080D0C]/90 border border-[rgba(183,255,232,0.08)] rounded-2xl px-5 py-3 backdrop-blur-xl flex flex-wrap items-center justify-between gap-4 text-left pointer-events-auto">
            <div className="flex items-center gap-3">
              <RadialProgress value={59.1} size={42} strokeWidth={5} />
              <div>
                <span className="text-sm font-bold text-[#F1F7F4] font-mono">59.1%</span>
                <p className="text-[10px] font-mono text-[#6D7C74] uppercase">Prep Coverage</p>
              </div>
            </div>

            <div className="border-l border-[rgba(183,255,232,0.08)] pl-4">
              <span className="text-sm font-bold text-[#00D6A0] font-mono">10 Topics</span>
              <p className="text-[10px] font-mono text-[#6D7C74] uppercase">Curriculum Mapped</p>
            </div>

            <div className="border-l border-[rgba(183,255,232,0.08)] pl-4">
              <span className="text-sm font-bold text-[#B7FFE8] font-mono">3 Documents</span>
              <p className="text-[10px] font-mono text-[#6D7C74] uppercase">Silberschatz OS</p>
            </div>

            <div className="border-l border-[rgba(183,255,232,0.08)] pl-4 hidden md:block">
              <span className="text-sm font-bold text-[#F87171] font-mono">4 Blind Spots</span>
              <p className="text-[10px] font-mono text-[#6D7C74] uppercase">Active Warnings</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          THE PROBLEM SECTION
          ========================================================================= */}
      <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 border-t border-[rgba(183,255,232,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D6A0]">
            [ THE COGNITIVE ILLUSION ]
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4] uppercase">
            Students don&apos;t fail from lack of studying. <br />
            <span className="text-mint-gradient italic font-serif normal-case">
              They fail from unexamined blind spots.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#A0ADA6] leading-relaxed">
            Most revision time is spent rereading slides or practicing concepts you already know. When exams arrive,
            the most costly mistakes occur on questions you felt 100% confident answering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Card 1: Conventional Passive AI */}
          <div className="rounded-2xl border border-[rgba(248,113,113,0.2)] bg-[#0D1512] p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F87171] to-transparent" />
            <div className="flex items-center gap-2 text-[#F87171] text-xs font-mono uppercase tracking-wider mb-3">
              <AlertTriangle className="h-4 w-4" /> The Chatbot Failure Mode
            </div>
            <h3 className="text-xl font-bold text-[#F1F7F4] mb-3">Passive Question-Answering</h3>
            <ul className="space-y-3 text-xs text-[#A0ADA6]">
              <li className="flex items-start gap-2">
                <span className="text-[#F87171] font-bold">•</span>
                Waits for students to ask questions, reinforcing existing biases rather than exposing unknown gaps.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#F87171] font-bold">•</span>
                Hallucinates generic web trivia instead of grounding explanations in your instructor&apos;s specific textbook.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#F87171] font-bold">•</span>
                Provides endless chat streams without scheduling realistic daily time allocations.
              </li>
            </ul>
          </div>

          {/* Card 2: GapLens Diagnostic Intelligence */}
          <div className="rounded-2xl border border-[rgba(0,214,160,0.25)] bg-[#0D1512] p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00D6A0] to-[#B7FFE8]" />
            <div className="flex items-center gap-2 text-[#00D6A0] text-xs font-mono uppercase tracking-wider mb-3">
              <ShieldCheck className="h-4 w-4" /> The GapLens Solution
            </div>
            <h3 className="text-xl font-bold text-[#F1F7F4] mb-3">Proactive Evidence Diagnostics</h3>
            <ul className="space-y-3 text-xs text-[#A0ADA6]">
              <li className="flex items-start gap-2">
                <span className="text-[#00D6A0] font-bold">•</span>
                Decoupled confidence scoring catches misconceptions before scoring correctness.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00D6A0] font-bold">•</span>
                Every diagnosis is pinned to exact page and paragraph citations from your course syllabus.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#00D6A0] font-bold">•</span>
                Time-budgeted knapsack scheduling packs high-priority tasks into your available daily minutes.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================================
          HOW IT WORKS (4 STAGES)
          ========================================================================= */}
      <section id="how-it-works" className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 border-t border-[rgba(183,255,232,0.08)]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D6A0]">
            [ SYSTEM ARCHITECTURE ]
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4] uppercase">
            From Syllabus to Mastery in 4 Steps
          </h2>
          <p className="mt-3 text-sm text-[#A0ADA6]">
            A closed-loop diagnostic workflow grounded in verified textbook evidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Step 1 */}
          <div className="rounded-2xl border border-[rgba(183,255,232,0.08)] bg-[#0D1512] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-[#121D18] border border-[rgba(183,255,232,0.12)] flex items-center justify-center text-[#00D6A0]">
                <BookOpen className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-[#6D7C74]">01 / INGEST</span>
            </div>
            <h3 className="text-base font-bold text-[#F1F7F4]">Curriculum Ingestion</h3>
            <p className="text-xs text-[#A0ADA6] leading-relaxed">
              Upload course PDFs, lecture slides, and past papers. Text is chunked with page and section metadata preservation.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-[rgba(183,255,232,0.08)] bg-[#0D1512] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-[#121D18] border border-[rgba(183,255,232,0.12)] flex items-center justify-center text-[#00D6A0]">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-[#6D7C74]">02 / MAP</span>
            </div>
            <h3 className="text-base font-bold text-[#F1F7F4]">Prerequisite DAG</h3>
            <p className="text-xs text-[#A0ADA6] leading-relaxed">
              Constructs a hierarchical directed knowledge graph showing which foundational concepts block advanced topics.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-[rgba(183,255,232,0.08)] bg-[#0D1512] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-[#121D18] border border-[rgba(183,255,232,0.12)] flex items-center justify-center text-[#00D6A0]">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-[#6D7C74]">03 / DIAGNOSE</span>
            </div>
            <h3 className="text-base font-bold text-[#F1F7F4]">Calibrated Diagnostics</h3>
            <p className="text-xs text-[#A0ADA6] leading-relaxed">
              Take diagnostic questions with confidence ratings. High-confidence errors are flagged with verified source quotes.
            </p>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl border border-[rgba(183,255,232,0.08)] bg-[#0D1512] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-[#121D18] border border-[rgba(183,255,232,0.12)] flex items-center justify-center text-[#00D6A0]">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-[#6D7C74]">04 / ADAPT</span>
            </div>
            <h3 className="text-base font-bold text-[#F1F7F4]">Knapsack Planning</h3>
            <p className="text-xs text-[#A0ADA6] leading-relaxed">
              Greedy knapsack scheduling packs prioritized revision tasks into your real daily study budget, updating with every retest.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FINAL CALL TO ACTION
          ========================================================================= */}
      <section className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="rounded-3xl border border-[rgba(0,214,160,0.3)] bg-gradient-to-b from-[#0D1512] to-[#080D0C] p-10 sm:p-14 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,214,160,0.2)_0%,rgba(8,13,12,0)_70%)] pointer-events-none -z-10" />

          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D6A0]">
            [ LIVE DEMO ENVIRONMENT ]
          </span>

          <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold text-[#F1F7F4] uppercase tracking-tight">
            Ready to explore your blind spots?
          </h2>

          <p className="mt-4 text-sm sm:text-base text-[#A0ADA6] max-w-xl mx-auto leading-relaxed">
            Experience the complete 6-screen academic intelligence loop pre-seeded with undergraduate Operating Systems CS-301.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handle1ClickJudgeDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#00D6A0] to-[#00B887] px-8 py-4 text-sm font-bold text-[#080D0C] shadow-[0_0_25px_rgba(0,214,160,0.35)] hover:shadow-[0_0_35px_rgba(0,214,160,0.5)] transition-all"
            >
              <Zap className="h-4 w-4 fill-[#080D0C]" />
              <span>Launch 1-Click Judge Demo</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-[rgba(183,255,232,0.14)] bg-[#0D1512] px-7 py-4 text-sm font-semibold text-[#F1F7F4] hover:bg-[#121D18] transition"
            >
              Sign In with Credentials
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
