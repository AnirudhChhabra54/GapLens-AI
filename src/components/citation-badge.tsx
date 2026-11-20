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
        "rounded-xl border border-[rgba(183,255,232,0.10)] bg-[#0D1512] p-3.5 shadow-sm text-xs transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#F1F7F4] font-medium truncate">
          <BookOpen className="h-3.5 w-3.5 text-[#00D6A0] shrink-0" />
          <span className="truncate">{documentName || "Course Material"}</span>
          <span className="rounded-full bg-[#121D18] text-[#B7FFE8] px-2 py-0.5 text-[10px] font-mono border border-[rgba(183,255,232,0.12)]">
            {pageLabel}
          </span>
          {sectionHeading && (
            <span className="text-[#6D7C74] text-[11px] hidden sm:inline truncate max-w-[200px]">
              • {sectionHeading}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isQuoteVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#121D18] text-[#00D6A0] px-2 py-0.5 text-[10px] font-mono font-medium border border-[rgba(0,214,160,0.3)]">
              <ShieldCheck className="h-3 w-3" />
              Verified Quote
            </span>
          )}

          {quote && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[#6D7C74] hover:text-[#F1F7F4] transition p-0.5"
              title={expanded ? "Hide excerpt" : "Show excerpt"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {quote && expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-[rgba(183,255,232,0.08)] text-[#A0ADA6] font-serif italic text-[11px] leading-relaxed bg-[#121D18]/90 p-3 rounded-lg border-l-2 border-l-[#00D6A0]">
          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 text-[#00D6A0] shrink-0 mt-0.5 not-italic" />
            <p>&quot;{quote}&quot;</p>
          </div>
        </div>
      )}
    </div>
  );
}
