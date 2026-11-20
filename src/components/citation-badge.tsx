"use client";

// ==============================================================================
// GapLens AI — Verified Citation Badge & Source Quote Card
// Pins transparent source document metadata directly to questions and evaluations
// ==============================================================================

import React, { useState } from "react";
import { BookOpen, ShieldCheck, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface CitationBadgeProps {
  documentName?: string | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionHeading?: string | null;
  quote?: string | null;
  isQuoteVerified?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

export function CitationBadge({
  documentName = "Silberschatz OS Concepts Core Notes",
  pageStart = 1,
  pageEnd,
  sectionHeading,
  quote,
  isQuoteVerified = true,
  className,
  defaultExpanded = false,
}: CitationBadgeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const pageLabel = pageEnd && pageEnd !== pageStart ? `pp. ${pageStart}–${pageEnd}` : `p. ${pageStart}`;

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-700/80 bg-slate-900/90 p-3.5 shadow-sm text-xs transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-200 font-medium truncate">
          <BookOpen className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="truncate">{documentName || "Course Material"}</span>
          <span className="rounded bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 text-[10px] font-mono border border-cyan-800/60">
            {pageLabel}
          </span>
          {sectionHeading && (
            <span className="text-slate-400 text-[11px] hidden sm:inline truncate max-w-[180px]">
              • {sectionHeading}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isQuoteVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-800/60">
              <ShieldCheck className="h-3 w-3" />
              Verified Quote
            </span>
          )}

          {quote && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-200 transition p-0.5"
              title={expanded ? "Hide excerpt" : "Show excerpt"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {quote && expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-slate-300 font-serif italic text-[11px] leading-relaxed bg-slate-950/60 p-2.5 rounded border-l-2 border-l-cyan-500">
          <div className="flex items-start gap-1.5">
            <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5 not-italic" />
            <p>&quot;{quote}&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
