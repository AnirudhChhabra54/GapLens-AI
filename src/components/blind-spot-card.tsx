"use client";

// ==============================================================================
// GapLens AI — High-Confidence Blind Spot Warning Card
// Highlights critical knowledge disconnects where student was confident but wrong
// Redesigned: Restrained editorial styling with warm-neutral borders and terracotta badge
// ==============================================================================

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CitationBadge } from "@/components/citation-badge";
import { Button } from "@/components/ui/design-system";

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
        "rounded-card border border-[#E8CFC4] bg-[#FDF9F7] p-5 shadow-xs relative overflow-hidden space-y-3.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-control bg-[#F2DDD3] text-[#85553F] shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#85553F] font-semibold block">
              High-Confidence Misconception
            </span>
            <h4 className="text-sm font-semibold text-brandText-primary">{topicTitle}</h4>
          </div>
        </div>

        <span className="rounded-full bg-surface text-[#85553F] border border-[#E8CFC4] px-2.5 py-0.5 text-[10px] font-mono font-medium shrink-0">
          Certainty: {confidence.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3 text-xs">
        {studentResponse && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-surface p-3 rounded-control border border-brandBorder">
            <div>
              <span className="text-[10px] font-mono text-[#B84A39] block mb-1 uppercase tracking-wider font-medium">
                Your Answer (High Certainty):
              </span>
              <p className="text-brandText-primary text-[11px] bg-surface-subtle p-2 rounded border border-brandBorder">
                &ldquo;{studentResponse}&rdquo;
              </p>
            </div>
            {correctAnswer && (
              <div>
                <span className="text-[10px] font-mono text-accent block mb-1 uppercase tracking-wider font-medium">
                  Verified Ground Truth:
                </span>
                <p className="text-brandText-primary text-[11px] bg-surface-subtle p-2 rounded border border-brandBorder">
                  &ldquo;{correctAnswer}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {misconceptionRationale && (
          <div className="text-brandText-secondary bg-surface p-3 rounded-control border border-brandBorder text-xs leading-relaxed">
            <span className="font-semibold text-brandText-primary block mb-1 font-mono text-[10px] uppercase tracking-wider">
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

        <div className="pt-2 border-t border-[#E8CFC4]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-brandText-secondary">
            <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[11px]">{remedyAction}</span>
          </div>

          <Link href="/diagnostic" className="shrink-0">
            <Button variant="secondary" size="sm">
              <span>Retest topic</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
