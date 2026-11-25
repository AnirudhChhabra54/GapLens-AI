// ==============================================================================
// Unit Test: Part 3 Differentiators (Forgetting Curve & Feynman Audit)
// ==============================================================================

import { describe, it, expect } from "vitest";
import { projectTopicMasteryAtDay, simulateForgettingCurve } from "@/lib/algorithms/forgetting-curve";
import { evaluateFeynmanTeachBack } from "@/lib/algorithms/feynman";
import type { TopicMastery } from "@/types/assessment";

describe("Unit: Exam-Day Forgetting-Curve Time Machine", () => {
  it("retains current mastery at Day 0 and decays monotonically over time", () => {
    const day0 = projectTopicMasteryAtDay(80, 1, 0);
    const day7 = projectTopicMasteryAtDay(80, 1, 7);
    const day21 = projectTopicMasteryAtDay(80, 1, 21);

    expect(day0).toBe(80);
    expect(day7).toBeLessThan(day0);
    expect(day21).toBeLessThan(day7);
    expect(day21).toBeGreaterThanOrEqual(25);
  });

  it("flags Silent Cliff topics that look safe today (>=60%) but fall below 55% by exam day", () => {
    const topics: TopicMastery[] = [
      {
        topicId: "t1",
        topicTitle: "Cache Coherence",
        unitModule: "Architecture",
        masteryScore: 68,
        classification: "medium",
        evidenceLevel: "early_signal",
        totalAttempts: 1,
        correctAttempts: 1,
        blindSpotCount: 0,
        examWeight: 0.2,
        examFrequency: 2,
        lastAttemptAt: null,
      },
      {
        topicId: "t2",
        topicTitle: "Deadlock Avoidance",
        unitModule: "OS",
        masteryScore: 95,
        classification: "strong",
        evidenceLevel: "strong_evidence",
        totalAttempts: 8,
        correctAttempts: 8,
        blindSpotCount: 0,
        examWeight: 0.2,
        examFrequency: 2,
        lastAttemptAt: null,
      },
    ];

    const sim = simulateForgettingCurve(topics, 14);
    expect(sim.silentCliffTopics.some((c) => c.topicId === "t1")).toBe(true);
    expect(sim.silentCliffTopics.some((c) => c.topicId === "t2")).toBe(false);
  });
});

describe("Unit: Feynman Teach-Back Evidence-Diff Grader", () => {
  it("produces verified claims, omitted mechanisms, and a bounded rigor score", async () => {
    const audit = await evaluateFeynmanTeachBack({
      topicTitle: "Virtual Memory Paging",
      studentExplanation:
        "Virtual memory divides logical memory into fixed-size pages and physical memory into frames using a page table.",
      chunks: [
        {
          id: "c1",
          document_id: "d1",
          document_name: "OS Concepts.pdf",
          page_start: 10,
          page_end: 11,
          section_heading: "Paging",
          content:
            "Paging avoids external fragmentation by mapping virtual pages to physical frames via a page table and hardware TLB.",
        },
      ],
    });

    expect(audit.topicTitle).toBe("Virtual Memory Paging");
    expect(audit.rigorScore).toBeGreaterThanOrEqual(0);
    expect(audit.rigorScore).toBeLessThanOrEqual(100);
    expect(audit.citations.length).toBeGreaterThan(0);
  });
});
