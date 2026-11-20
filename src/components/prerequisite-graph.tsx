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
        "rounded-2xl border border-slate-800 bg-[#0B0F19]/90 p-5 shadow-xl space-y-6",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-cyan-400" />
            Curriculum Dependency Flow & Prerequisite DAG
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive syllabus knowledge pathway. Click any node to inspect prerequisite chains and exam weight.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium shrink-0">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Strong (≥80%)
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium (55–79%)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Weak (&lt;55%)
          </span>
        </div>
      </div>

      {/* Visual Unit Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {units.map(([unitName, unitTopics], unitIdx) => (
          <div
            key={unitName}
            className="rounded-xl border border-slate-800/90 bg-slate-900/60 p-4 space-y-3 relative"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 truncate">
                <Layers className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                {unitName}
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                {unitTopics.length} topics
              </span>
            </div>

            <div className="space-y-2">
              {unitTopics.map((topic) => {
                const isSelected = selectedTopic?.id === topic.id;
                const status = topic.classification || "unassessed";
                const mastery = topic.current_mastery ?? 45;

                let borderClass = "border-slate-800 hover:border-slate-700";
                let badgeClass = "bg-slate-800 text-slate-300";

                if (status === "strong") {
                  borderClass = isSelected
                    ? "border-emerald-500 bg-emerald-950/30"
                    : "border-emerald-900/60 hover:border-emerald-700 bg-emerald-950/15";
                  badgeClass = "bg-emerald-950 text-emerald-400 border border-emerald-800/80";
                } else if (status === "medium") {
                  borderClass = isSelected
                    ? "border-amber-500 bg-amber-950/30"
                    : "border-amber-900/60 hover:border-amber-700 bg-amber-950/15";
                  badgeClass = "bg-amber-950 text-amber-400 border border-amber-800/80";
                } else if (status === "weak") {
                  borderClass = isSelected
                    ? "border-rose-500 bg-rose-950/30"
                    : "border-rose-900/60 hover:border-rose-700 bg-rose-950/15";
                  badgeClass = "bg-rose-950 text-rose-400 border border-rose-800/80";
                }

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all relative overflow-hidden group",
                      borderClass
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition line-clamp-2">
                        {topic.title}
                      </span>
                      <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0", badgeClass)}>
                        {Math.round(mastery)}%
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Exam: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"}</span>
                      {topic.blind_spot_count && topic.blind_spot_count > 0 ? (
                        <span className="text-rose-400 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Blind Spot
                        </span>
                      ) : (
                        <span className="text-slate-500">{topic.total_attempts || 0} attempts</span>
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
        <div className="rounded-xl border border-cyan-900/60 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/20 p-4 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                Selected Topic Inspection
              </span>
              <h4 className="text-sm font-bold text-slate-100">{selectedTopic.title}</h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300 text-[11px]">
                Unit: {selectedTopic.unit_module || "Core"}
              </span>
              <span
                className={cn(
                  "rounded px-2 py-1 font-bold text-[11px]",
                  selectedTopic.classification === "strong"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : selectedTopic.classification === "medium"
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                )}
              >
                Current Mastery: {Math.round(selectedTopic.current_mastery ?? 45)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Direct Prerequisites */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-amber-400 rotate-180" /> Direct Prerequisites:
              </span>
              {getPrereqsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No prerequisites (Foundational entry topic).</p>
              ) : (
                <ul className="space-y-1">
                  {getPrereqsForTopic(selectedTopic.id).map((p) => (
                    <li key={p.id} className="text-slate-300 flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      {p.title} ({Math.round(p.current_mastery ?? 45)}%)
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Downstream Dependents */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-cyan-400" /> Downstream Blocked Topics:
              </span>
              {getDependentsForTopic(selectedTopic.id).length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">Terminal topic (No downstream dependents).</p>
              ) : (
                <ul className="space-y-1">
                  {getDependentsForTopic(selectedTopic.id).map((d) => (
                    <li key={d.id} className="text-slate-300 flex items-center gap-1.5 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
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
