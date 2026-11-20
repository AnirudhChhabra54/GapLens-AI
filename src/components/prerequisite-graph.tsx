"use client";

// ==============================================================================
// GapLens AI — Interactive Topic Prerequisite DAG & Dependency Map
// Visualizes curriculum learning pathways, prerequisite blockers, and mastery states
// Redesigned: Editorial light-first styling with warm borders and muted status badges
// ==============================================================================

import React, { useState } from "react";
import { GitBranch, AlertTriangle, ArrowRight, Layers, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicRow, TopicPrerequisiteRow } from "@/types/database";
import { Card, StatusBadge } from "@/components/ui/design-system";

interface PrerequisiteGraphProps {
  topics: TopicRow[];
  prerequisites: TopicPrerequisiteRow[];
  className?: string;
  onSelectTopic?: (topic: TopicRow) => void;
}

export function PrerequisiteGraph({
  topics,
  prerequisites,
  className,
  onSelectTopic,
}: PrerequisiteGraphProps) {
  const [selectedTopic, setSelectedTopic] = useState<TopicRow | null>(topics[0] || null);

  // Group topics by Unit/Module
  const unitsMap = new Map<string, TopicRow[]>();
  for (const t of topics) {
    const unit = t.unit_module || "Core Operating Systems";
    if (!unitsMap.has(unit)) {
      unitsMap.set(unit, []);
    }
    unitsMap.get(unit)!.push(t);
  }

  const units = Array.from(unitsMap.entries());

  // Find prerequisite relationships
  const getPrereqsForTopic = (topicId: string) => {
    const prereqIds = prerequisites
      .filter((p) => p.topic_id === topicId)
      .map((p) => p.prerequisite_topic_id);
    return topics.filter((t) => prereqIds.includes(t.id));
  };

  const getDependentsForTopic = (topicId: string) => {
    const dependentIds = prerequisites
      .filter((p) => p.prerequisite_topic_id === topicId)
      .map((p) => p.topic_id);
    return topics.filter((t) => dependentIds.includes(t.id));
  };

  const handleTopicClick = (topic: TopicRow) => {
    setSelectedTopic(topic);
    if (onSelectTopic) onSelectTopic(topic);
  };

  return (
    <Card className={cn("space-y-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brandBorder pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-accent font-semibold">
              Curriculum Dependency Map
            </span>
          </div>
          <h3 className="text-base font-semibold text-brandText-primary flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-accent" />
            <span>Topic Prerequisites & Learning Pathways</span>
          </h3>
          <p className="text-xs text-brandText-secondary mt-0.5">
            Click any topic node to inspect foundational prerequisites and downstream unlocked concepts.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-accent">
            <span className="h-2 w-2 rounded-full bg-accent" /> Strong (≥80%)
          </span>
          <span className="flex items-center gap-1.5 text-[#C27803]">
            <span className="h-2 w-2 rounded-full bg-[#C27803]" /> Developing (55–79%)
          </span>
          <span className="flex items-center gap-1.5 text-[#B84A39]">
            <span className="h-2 w-2 rounded-full bg-[#B84A39]" /> Needs work (&lt;55%)
          </span>
          <span className="flex items-center gap-1.5 text-brandText-muted">
            <span className="h-2 w-2 rounded-full bg-brandBorder-strong" /> Not assessed
          </span>
        </div>
      </div>

      {/* Visual Unit Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {units.map(([unitName, unitTopics]) => (
          <div
            key={unitName}
            className="rounded-card border border-brandBorder bg-surface-subtle p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
              <span className="text-xs font-semibold text-brandText-primary flex items-center gap-1.5 truncate">
                <Layers className="h-3.5 w-3.5 text-accent shrink-0" />
                {unitName}
              </span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-mono text-brandText-muted border border-brandBorder">
                {unitTopics.length}
              </span>
            </div>

            <div className="space-y-2">
              {unitTopics.map((topic) => {
                const isSelected = selectedTopic?.id === topic.id;
                const status = topic.classification || "unassessed";
                const mastery = topic.current_mastery ?? 45;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className={cn(
                      "w-full text-left p-3 rounded-control border transition-all relative group bg-surface",
                      isSelected
                        ? "border-accent ring-1 ring-accent bg-accent-soft/30 shadow-sm"
                        : "border-brandBorder hover:border-brandBorder-strong hover:bg-surface-subtle"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-brandText-primary group-hover:text-accent transition line-clamp-2">
                        {topic.title}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-mono font-medium px-1.5 py-0.5 rounded shrink-0",
                          status === "strong"
                            ? "bg-accent-soft text-accent"
                            : status === "medium"
                            ? "bg-[#FEF5E7] text-[#C27803]"
                            : status === "weak"
                            ? "bg-[#FDF0EE] text-[#B84A39]"
                            : "bg-surface-subtle text-brandText-muted"
                        )}
                      >
                        {Math.round(mastery)}%
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-brandText-muted font-mono">
                      <span>Exam: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"}</span>
                      {topic.blind_spot_count && topic.blind_spot_count > 0 ? (
                        <span className="text-[#B84A39] font-medium flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Blind spot
                        </span>
                      ) : (
                        <span>{topic.total_attempts || 0} attempts</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Topic Inspector Drawer / Card */}
      {selectedTopic && (
        <div className="rounded-card border border-brandBorder bg-surface p-4 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-brandBorder">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                Topic Details & Blockers
              </span>
              <h4 className="text-sm font-semibold text-brandText-primary">{selectedTopic.title}</h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-control bg-surface-subtle border border-brandBorder px-2.5 py-1 text-brandText-secondary text-[11px] font-mono">
                Unit: {selectedTopic.unit_module || "Core"}
              </span>
              <span className="rounded-control bg-surface-subtle border border-brandBorder px-2.5 py-1 text-brandText-primary font-mono text-[11px] font-medium">
                Mastery: {Math.round(selectedTopic.current_mastery ?? 45)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct Prerequisites */}
            <div className="bg-surface-subtle p-3 rounded-control border border-brandBorder">
              <span className="text-[11px] font-semibold text-brandText-secondary block mb-1.5 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <ArrowRight className="h-3 w-3 text-accent rotate-180" /> Direct Prerequisites:
              </span>
              {getPrereqsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-brandText-muted italic text-[11px]">Foundational entry topic (zero prerequisites required).</p>
              ) : (
                <ul className="space-y-1">
                  {getPrereqsForTopic(selectedTopic.id).map((p) => (
                    <li key={p.id} className="text-brandText-primary flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {p.title} ({Math.round(p.current_mastery ?? 45)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Downstream Dependents */}
            <div className="bg-surface-subtle p-3 rounded-control border border-brandBorder">
              <span className="text-[11px] font-semibold text-brandText-secondary block mb-1.5 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <ArrowRight className="h-3 w-3 text-accent" /> Downstream Blocked Topics:
              </span>
              {getDependentsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-brandText-muted italic text-[11px]">Terminal topic (no downstream dependents).</p>
              ) : (
                <ul className="space-y-1">
                  {getDependentsForTopic(selectedTopic.id).map((d) => (
                    <li key={d.id} className="text-brandText-primary flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C27803]" />
                      {d.title} ({Math.round(d.current_mastery ?? 45)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
