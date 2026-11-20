"use client";

// ==============================================================================
// GapLens AI — Interactive Topic Prerequisite DAG & Visual Flow
// Visualizes curriculum learning pathways, prerequisite blockers, and mastery states
// ==============================================================================

import React, { useState } from "react";
import { GitBranch, CheckCircle2, AlertTriangle, ArrowRight, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicRow, TopicPrerequisiteRow } from "@/types/database";

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
    const unit = t.unit_module || "General Operating Systems";
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
    <div
      className={cn(
        "rounded-2xl border border-[rgba(183,255,232,0.10)] bg-[#0D1512] p-5 sm:p-6 shadow-xl space-y-6",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(183,255,232,0.08)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D6A0]">
              [ KNOWLEDGE GRAPH / PREREQUISITE DAG ]
            </span>
          </div>
          <h3 className="text-base font-bold text-[#F1F7F4] flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#00D6A0]" />
            Curriculum Dependency Flow
          </h3>
          <p className="text-xs text-[#A0ADA6] mt-0.5">
            Interactive syllabus pathway. Click any node to inspect prerequisite dependencies and exam weights.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-[#00D6A0]">
            <span className="h-2 w-2 rounded-full bg-[#00D6A0]" /> Strong (≥80%)
          </span>
          <span className="flex items-center gap-1.5 text-[#FBBF24]">
            <span className="h-2 w-2 rounded-full bg-[#FBBF24]" /> Medium (55–79%)
          </span>
          <span className="flex items-center gap-1.5 text-[#F87171]">
            <span className="h-2 w-2 rounded-full bg-[#F87171]" /> Weak (&lt;55%)
          </span>
        </div>
      </div>

      {/* Visual Unit Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {units.map(([unitName, unitTopics]) => (
          <div
            key={unitName}
            className="rounded-xl border border-[rgba(183,255,232,0.08)] bg-[#121D18] p-4 space-y-3 relative"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(183,255,232,0.06)]">
              <span className="text-xs font-semibold text-[#F1F7F4] flex items-center gap-1.5 truncate">
                <Layers className="h-3.5 w-3.5 text-[#00D6A0] shrink-0" />
                {unitName}
              </span>
              <span className="rounded-full bg-[#0D1512] px-2 py-0.5 text-[10px] font-mono text-[#A0ADA6] border border-[rgba(183,255,232,0.08)]">
                {unitTopics.length} topics
              </span>
            </div>

            <div className="space-y-2">
              {unitTopics.map((topic) => {
                const isSelected = selectedTopic?.id === topic.id;
                const status = topic.classification || "unassessed";
                const mastery = topic.current_mastery ?? 45;

                let borderClass = "border-[rgba(183,255,232,0.08)] hover:border-[rgba(183,255,232,0.18)] bg-[#0D1512]";
                let badgeClass = "bg-[#17231D] text-[#A0ADA6]";

                if (status === "strong") {
                  borderClass = isSelected
                    ? "border-[#00D6A0] bg-[#121D18] shadow-[0_0_15px_rgba(0,214,160,0.15)]"
                    : "border-[rgba(0,214,160,0.25)] hover:border-[#00D6A0] bg-[#0D1512]";
                  badgeClass = "bg-[#121D18] text-[#00D6A0] border border-[rgba(0,214,160,0.3)]";
                } else if (status === "medium") {
                  borderClass = isSelected
                    ? "border-[#FBBF24] bg-[#121D18] shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                    : "border-[rgba(251,191,36,0.25)] hover:border-[#FBBF24] bg-[#0D1512]";
                  badgeClass = "bg-[#121D18] text-[#FBBF24] border border-[rgba(251,191,36,0.3)]";
                } else if (status === "weak") {
                  borderClass = isSelected
                    ? "border-[#F87171] bg-[#121D18] shadow-[0_0_15px_rgba(248,113,113,0.15)]"
                    : "border-[rgba(248,113,113,0.25)] hover:border-[#F87171] bg-[#0D1512]";
                  badgeClass = "bg-[#121D18] text-[#F87171] border border-[rgba(248,113,113,0.3)]";
                }

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden group",
                      borderClass
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#F1F7F4] group-hover:text-[#B7FFE8] transition line-clamp-2">
                        {topic.title}
                      </span>
                      <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0", badgeClass)}>
                        {Math.round(mastery)}%
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-[#6D7C74] font-mono">
                      <span>Exam: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"}</span>
                      {topic.blind_spot_count && topic.blind_spot_count > 0 ? (
                        <span className="text-[#F87171] font-bold flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Blind Spot
                        </span>
                      ) : (
                        <span className="text-[#6D7C74]">{topic.total_attempts || 0} attempts</span>
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
        <div className="rounded-xl border border-[rgba(0,214,160,0.2)] bg-[#121D18] p-4 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[rgba(183,255,232,0.08)]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D6A0]">
                Node Inspector
              </span>
              <h4 className="text-sm font-bold text-[#F1F7F4]">{selectedTopic.title}</h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#0D1512] border border-[rgba(183,255,232,0.10)] px-2.5 py-0.5 text-[#A0ADA6] text-[11px] font-mono">
                Unit: {selectedTopic.unit_module || "Core"}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 font-bold font-mono text-[11px]",
                  selectedTopic.classification === "strong"
                    ? "bg-[#17231D] text-[#00D6A0] border border-[rgba(0,214,160,0.3)]"
                    : selectedTopic.classification === "medium"
                    ? "bg-[#17231D] text-[#FBBF24] border border-[rgba(251,191,36,0.3)]"
                    : "bg-[#17231D] text-[#F87171] border border-[rgba(248,113,113,0.3)]"
                )}
              >
                Mastery: {Math.round(selectedTopic.current_mastery ?? 45)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Direct Prerequisites */}
            <div className="bg-[#0D1512] p-3 rounded-lg border border-[rgba(183,255,232,0.08)]">
              <span className="text-[11px] font-semibold text-[#A0ADA6] block mb-1.5 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <ArrowRight className="h-3 w-3 text-[#FBBF24] rotate-180" /> Direct Prerequisites:
              </span>
              {getPrereqsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-[#6D7C74] italic text-[11px]">Foundational entry topic (zero prerequisites).</p>
              ) : (
                <ul className="space-y-1">
                  {getPrereqsForTopic(selectedTopic.id).map((p) => (
                    <li key={p.id} className="text-[#F1F7F4] flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#00D6A0]" />
                      {p.title} ({Math.round(p.current_mastery ?? 45)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Downstream Dependents */}
            <div className="bg-[#0D1512] p-3 rounded-lg border border-[rgba(183,255,232,0.08)]">
              <span className="text-[11px] font-semibold text-[#A0ADA6] block mb-1.5 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <ArrowRight className="h-3 w-3 text-[#00D6A0]" /> Downstream Blocked Topics:
              </span>
              {getDependentsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-[#6D7C74] italic text-[11px]">Terminal topic (no downstream dependents).</p>
              ) : (
                <ul className="space-y-1">
                  {getDependentsForTopic(selectedTopic.id).map((d) => (
                    <li key={d.id} className="text-[#F1F7F4] flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FBBF24]" />
                      {d.title} ({Math.round(d.current_mastery ?? 45)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
