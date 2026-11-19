// ==============================================================================
// Unit Test: Confidence Calibration & Blind-Spot Detection Engine
// Verifies decoupled confidence capture, high-confidence misconception classification,
// imposter syndrome detection, citation-backed remedy action generation, and aggregation.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  classifyConfidenceAlignment,
  generateRemedyAction,
  aggregateBlindSpots,
  computeConfidenceMetrics,
  DEFAULT_BLIND_SPOT_SCORE_THRESHOLD,
  DEFAULT_IMPOSTER_SCORE_THRESHOLD,
  type EvaluatedAnswerInput,
} from "@/lib/algorithms/blind-spots";
import type { PinnedCitation } from "@/types/rag";

describe("Unit: Confidence Calibration & Blind Spots (blind-spots.ts)", () => {
  describe("Default Thresholds", () => {
    it("should have correct default calibration thresholds", () => {
      expect(DEFAULT_BLIND_SPOT_SCORE_THRESHOLD).toBe(0.50);
      expect(DEFAULT_IMPOSTER_SCORE_THRESHOLD).toBe(0.80);
    });
  });

  describe("Calibration Classification Matrix", () => {
    it("should classify High confidence with low score (< 0.50) as a Blind Spot", () => {
      const res1 = classifyConfidenceAlignment("high", 0.0);
      const res2 = classifyConfidenceAlignment("high", 0.49);

      expect(res1.isBlindSpot).toBe(true);
      expect(res1.label).toBe("blind_spot");
      expect(res2.isBlindSpot).toBe(true);
      expect(res2.label).toBe("blind_spot");
    });

    it("should NOT classify High confidence with score >= 0.50 as a blind spot", () => {
      const res1 = classifyConfidenceAlignment("high", 0.50);
      const res2 = classifyConfidenceAlignment("high", 1.0);

      expect(res1.isBlindSpot).toBe(false);
      expect(res1.label).toBe("aligned");
      expect(res2.isBlindSpot).toBe(false);
      expect(res2.label).toBe("aligned");
    });

    it("should classify Low confidence with high score (>= 0.80) as Uncertain Success (Imposter)", () => {
      const res1 = classifyConfidenceAlignment("low", 0.80);
      const res2 = classifyConfidenceAlignment("low", 1.0);

      expect(res1.isUncertainSuccess).toBe(true);
      expect(res1.label).toBe("uncertain_success");
      expect(res2.isUncertainSuccess).toBe(true);
      expect(res2.label).toBe("uncertain_success");
    });

    it("should NOT classify Low confidence with score < 0.80 as uncertain success", () => {
      const res = classifyConfidenceAlignment("low", 0.79);
      expect(res.isUncertainSuccess).toBe(false);
      expect(res.label).toBe("aligned");
    });

    it("should classify Medium confidence as aligned regardless of score", () => {
      expect(classifyConfidenceAlignment("medium", 0.0).label).toBe("aligned");
      expect(classifyConfidenceAlignment("medium", 0.5).label).toBe("aligned");
      expect(classifyConfidenceAlignment("medium", 1.0).label).toBe("aligned");
    });

    it("should support custom calibration threshold options", () => {
      // Custom threshold: score < 0.40
      const custom = classifyConfidenceAlignment("high", 0.45, { blindSpotThreshold: 0.40 });
      expect(custom.isBlindSpot).toBe(false);

      const customHit = classifyConfidenceAlignment("high", 0.35, { blindSpotThreshold: 0.40 });
      expect(customHit.isBlindSpot).toBe(true);
    });
  });

  describe("Remedy Action Generation", () => {
    it("should generate actionable remedy referencing authentic citation metadata", () => {
      const citation: PinnedCitation = {
        chunkId: "c-101",
        documentId: "d-1",
        documentName: "Operating Systems Concepts",
        docType: "material",
        pageStart: 42,
        pageEnd: 43,
        sectionHeading: "Deadlock Prevention",
        quote: "Deadlock can be prevented by invalidating one of the four necessary conditions.",
        isQuoteVerified: true,
      };

      const remedy = generateRemedyAction({
        topicTitle: "Deadlock Detection",
        citation,
        questionText: "Which condition cannot be easily eliminated?",
        explanation: "Mutual exclusion cannot be denied for non-shareable resources.",
      });

      expect(remedy).toContain("Deadlock Prevention");
      expect(remedy).toContain("Operating Systems Concepts");
      expect(remedy).toContain("Mutual exclusion cannot be denied");
    });
  });

  describe("Blind Spot Aggregation", () => {
    it("should aggregate blind spots, sort high risk topics, and preserve evidence", () => {
      const mockCitation: PinnedCitation = {
        chunkId: "c-1",
        documentId: "d-1",
        documentName: "OS Notes",
        docType: "material",
        pageStart: 10,
        pageEnd: 12,
        sectionHeading: "Virtual Memory",
        quote: "Page faults occur when a referenced page is not in physical memory.",
        isQuoteVerified: true,
      };

      const mockAnswers: EvaluatedAnswerInput[] = [
        // Topic A: 2 blind spots
        {
          topicId: "top-a",
          topicTitle: "Virtual Memory",
          questionId: "q-1",
          questionText: "What triggers a page fault?",
          studentResponse: "TLB hit",
          correctAnswer: "Invalid page table entry",
          confidence: "high",
          score: 0.0,
          citation: mockCitation,
          explanation: "Page fault occurs on missing frame in physical RAM.",
        },
        {
          topicId: "top-a",
          topicTitle: "Virtual Memory",
          questionId: "q-2",
          questionText: "How is TLB miss handled?",
          studentResponse: "Disk read directly",
          correctAnswer: "Page table walk",
          confidence: "high",
          score: 0.25,
          citation: mockCitation,
          explanation: "MMU walks page table on TLB miss.",
        },
        // Topic B: 1 blind spot
        {
          topicId: "top-b",
          topicTitle: "Peterson's Algorithm",
          questionId: "q-3",
          questionText: "Does Peterson algorithm work on modern multi-cores?",
          studentResponse: "Yes, flawlessly",
          correctAnswer: "No, due to memory reordering",
          confidence: "high",
          score: 0.0,
          citation: mockCitation,
          explanation: "Hardware memory reordering breaks software synchronization.",
        },
        // Topic C: 1 aligned success
        {
          topicId: "top-c",
          topicTitle: "CPU Scheduling",
          questionId: "q-4",
          questionText: "What is Round Robin scheduling?",
          studentResponse: "Time sliced FIFO",
          correctAnswer: "Time sliced FIFO",
          confidence: "high",
          score: 1.0,
          citation: mockCitation,
        },
      ];

      const summary = aggregateBlindSpots(mockAnswers);

      expect(summary.totalBlindSpots).toBe(3);
      expect(summary.highRiskTopics.length).toBe(2);
      expect(summary.highRiskTopics[0].topicId).toBe("top-a");
      expect(summary.highRiskTopics[0].blindSpotCount).toBe(2);
      expect(summary.highRiskTopics[1].topicId).toBe("top-b");
      expect(summary.highRiskTopics[1].blindSpotCount).toBe(1);
      expect(summary.items.length).toBe(3);
      expect(summary.items[0].remedyAction).toBeDefined();
    });
  });
  describe("Confidence Calibration Metrics (H2)", () => {
    const citation: PinnedCitation = {
      chunkId: "c-metric",
      documentId: "d-metric",
      documentName: "OS Notes",
      docType: "material",
      pageStart: 1,
      pageEnd: 1,
      sectionHeading: "Virtual Memory",
      quote: "A page fault occurs when the valid bit is zero.",
      isQuoteVerified: true,
    };

    const mk = (
      id: string,
      topicId: string,
      confidence: "low" | "medium" | "high",
      score: number
    ): EvaluatedAnswerInput => ({
      topicId,
      topicTitle: topicId,
      questionId: id,
      questionText: "Question",
      studentResponse: "Response",
      correctAnswer: "Answer",
      confidence,
      score,
      citation,
    });

    it("should compute independent high-confidence error and low-confidence correct rates", () => {
      const metrics = computeConfidenceMetrics([
        mk("q1", "t1", "high", 0.0),
        mk("q2", "t1", "high", 1.0),
        mk("q3", "t2", "low", 1.0),
        mk("q4", "t2", "low", 0.0),
      ]);

      expect(metrics.totalAnswers).toBe(4);
      expect(metrics.highConfidenceAttempts).toBe(2);
      expect(metrics.highConfidenceIncorrect).toBe(1);
      expect(metrics.highConfidenceErrorRate).toBe(0.5);
      expect(metrics.lowConfidenceAttempts).toBe(2);
      expect(metrics.lowConfidenceCorrect).toBe(1);
      expect(metrics.lowConfidenceCorrectRate).toBe(0.5);
      expect(metrics.sampleSufficient).toBe(true);
      expect(metrics.topicSampleCounts).toHaveLength(2);
    });

    it("should mark small samples as insufficient for strong calibration claims", () => {
      const metrics = computeConfidenceMetrics([mk("q1", "t1", "high", 0.0)]);
      expect(metrics.sampleSufficient).toBe(false);
      expect(metrics.highConfidenceErrorRate).toBe(1);
    });

    it("should attach calibration metrics to the blind-spot summary", () => {
      const summary = aggregateBlindSpots([mk("q1", "t1", "high", 0.0)]);
      expect(summary.calibration).toBeDefined();
      expect(summary.calibration!.highConfidenceIncorrect).toBe(1);
    });
  });
});
