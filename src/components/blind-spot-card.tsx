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
        "rounded-2xl border border-[rgba(248,113,113,0.25)] bg-[#0D1512] p-5 shadow-xl relative overflow-hidden",
        className
      )}
    >
      {/* Top subtle hairline accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F87171] via-[#FBBF24] to-transparent" />

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#121D18] border border-[rgba(248,113,113,0.3)] text-[#F87171]">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#F87171]">
              <AlertTriangle className="h-3 w-3" /> High-Confidence Blind Spot
            </span>
            <h4 className="text-base font-bold text-[#F1F7F4]">{topicTitle}</h4>
          </div>
        </div>

        <span className="rounded-full bg-[#121D18] text-[#F87171] border border-[rgba(248,113,113,0.3)] px-2.5 py-0.5 text-[11px] font-mono font-medium shrink-0">
          Certainty: {confidence.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3 text-xs">
        {studentResponse && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#121D18] p-3 rounded-xl border border-[rgba(183,255,232,0.06)]">
            <div>
              <span className="text-[10px] font-mono text-[#F87171] block mb-1 uppercase tracking-wider">
                Your Answer (Marked with High Certainty):
              </span>
              <p className="text-[#F1F7F4] font-mono text-[11px] bg-[#0D1512] p-2.5 rounded-lg border border-[rgba(248,113,113,0.2)]">
                &quot;{studentResponse}&quot;
              </p>
            </div>
            {correctAnswer && (
              <div>
                <span className="text-[10px] font-mono text-[#00D6A0] block mb-1 uppercase tracking-wider">
                  Verified Ground Truth:
                </span>
                <p className="text-[#F1F7F4] font-mono text-[11px] bg-[#0D1512] p-2.5 rounded-lg border border-[rgba(0,214,160,0.2)]">
                  &quot;{correctAnswer}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {misconceptionRationale && (
          <div className="text-[#A0ADA6] bg-[#121D18] p-3.5 rounded-xl border border-[rgba(183,255,232,0.06)] text-[12px] leading-relaxed">
            <span className="font-semibold text-[#F1F7F4] block mb-1 font-mono text-[11px] uppercase tracking-wider">
              Diagnosed Misconception:
            </span>
            {misconceptionRationale}
          </div>
        )}

        {citation && citation.quote && (
          <div className="mt-2">
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

        <div className="pt-3 border-t border-[rgba(183,255,232,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#A0ADA6]">
            <Sparkles className="h-3.5 w-3.5 text-[#00D6A0] shrink-0" />
            <span className="text-[11px]">{remedyAction}</span>
          </div>

          <Link
            href="/diagnostic"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#17231D] hover:bg-[#1D2C24] border border-[rgba(183,255,232,0.14)] px-3.5 py-1.5 text-xs font-semibold text-[#F1F7F4] hover:text-[#00D6A0] transition-colors shrink-0"
          >
            <span>Retest This Topic</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
