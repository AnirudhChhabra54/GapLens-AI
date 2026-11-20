"use client";

// ==============================================================================
// GapLens AI — Verified Citation Badge & Source Quote Card
// Pins transparent source document metadata directly to questions and evaluations
// Redesigned: Editorial light styling with warm borders and slate-blue accent
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
        "rounded-control border border-brandBorder bg-surface p-3 text-xs transition-colors shadow-xs",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-brandText-primary font-medium truncate">
          <BookOpen className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="truncate">{documentName || "Course Material"}</span>
          <span className="rounded-full bg-surface-subtle text-brandText-secondary px-2 py-0.5 text-[10px] font-mono border border-brandBorder">
            {pageLabel}
          </span>
          {sectionHeading && (
            <span className="text-brandText-muted text-[11px] hidden sm:inline truncate max-w-[200px]">
              • {sectionHeading}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isQuoteVerified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent px-2 py-0.5 text-[10px] font-mono font-medium border border-[#C8D6DE]">
              <ShieldCheck className="h-3 w-3" />
              Verified source
            </span>
          )}

          {quote && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-brandText-muted hover:text-brandText-primary transition p-0.5"
              title={expanded ? "Hide excerpt" : "Show excerpt"}
              aria-label={expanded ? "Hide excerpt" : "Show excerpt"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {quote && expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-brandBorder text-brandText-secondary font-serif italic text-xs leading-relaxed bg-[#FAF8F3] p-3 rounded-control border-l-2 border-l-accent">
          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5 not-italic" />
            <p>&ldquo;{quote}&rdquo;</p>
          </div>
        </div>
      )}
    </div>
  );
}
