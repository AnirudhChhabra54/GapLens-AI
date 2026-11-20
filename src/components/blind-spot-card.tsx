"use client";

// ==============================================================================
// GapLens AI — High-Confidence Blind Spot Warning Card
// Highlights critical knowledge disconnects where student was confident but wrong
// ==============================================================================

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationBadge } from "@/components/citation-badge";

interface BlindSpotCardProps {
  topicTitle: string;
  topicId?: string;
  confidence?: "high" | "medium" | "low";
  studentResponse?: string | null;
  correctAnswer?: string | null;
  misconceptionRationale?: string | null;
  remedyAction?: string | null;
  citation?: {
    documentName?: string | null;
    pageStart?: number | null;
    pageEnd?: number | null;
    sectionHeading?: string | null;
    quote?: string | null;
    isQuoteVerified?: boolean;
  };
  className?: string;
}

export function BlindSpotCard({
  topicTitle,
  topicId,
  confidence = "high",
  studentResponse,
  correctAnswer,
  misconceptionRationale,
  remedyAction = "Review textbook citations and complete targeted practice drill.",
  citation,
  className,
}: BlindSpotCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-red-900/60 bg-gradient-to-b from-red-950/40 to-slate-900/90 p-5 shadow-lg relative overflow-hidden",
        className
      )}
    >
      {/* Decorative top accent glow */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-red-900/60 border border-red-700/60 text-red-400">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-rose-400">
              <AlertTriangle className="h-3 w-3" /> High-Confidence Blind Spot
            </span>
            <h4 className="text-base font-bold text-slate-100">{topicTitle}</h4>
          </div>
        </div>

        <span className="rounded-full bg-rose-950 text-rose-300 border border-rose-800/80 px-2.5 py-0.5 text-xs font-semibold shrink-0">
          Confidence: {confidence.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3 text-xs">
        {studentResponse && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <div>
              <span className="text-[11px] font-medium text-rose-400 block mb-1">
                Your Answer (Marked with High Certainty):
              </span>
              <p className="text-slate-300 font-mono text-[11px] bg-red-950/30 p-2 rounded border border-red-900/40">
                &quot;{studentResponse}&quot;
              </p>
            </div>
            {correctAnswer && (
              <div>
                <span className="text-[11px] font-medium text-emerald-400 block mb-1">
                  Correct Ground Truth:
                </span>
                <p className="text-slate-300 font-mono text-[11px] bg-emerald-950/30 p-2 rounded border border-emerald-900/40">
                  &quot;{correctAnswer}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {misconceptionRationale && (
          <div className="text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-[12px] leading-relaxed">
            <span className="font-semibold text-rose-300 block mb-0.5">Diagnosed Misconception:</span>
            {misconceptionRationale}
          </div>
        )}

        {/* Source Citation */}
        {citation && (
          <div className="mt-2">
            <span className="text-[11px] font-medium text-slate-400 mb-1.5 block flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-cyan-400" /> Textbook Ground Truth:
            </span>
            <CitationBadge
              documentName={citation.documentName}
              pageStart={citation.pageStart}
              pageEnd={citation.pageEnd}
              sectionHeading={citation.sectionHeading}
              quote={citation.quote}
              isQuoteVerified={citation.isQuoteVerified}
              defaultExpanded={true}
            />
          </div>
        )}

        {/* Action remedy */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-red-950/20 p-3 rounded-lg border border-red-900/30">
          <div className="flex items-center gap-2 text-rose-200 text-xs">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Targeted Remedy:</strong> {remedyAction}
            </span>
          </div>

          <Link
            href="/planner"
            className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium px-3 py-1.5 text-xs shadow transition shrink-0"
          >
            Schedule Remediation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
