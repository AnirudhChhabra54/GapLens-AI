// ==============================================================================
// Unit Test: Topic Hierarchy & Past-Paper Mapping Engine
// Verifies syllabus topic extraction, prerequisite graph generation, past-paper mapping,
// low-confidence review flagging (<0.60), authentic exam weight computation, and tree hierarchy.
// ==============================================================================

import { describe, it, expect } from "vitest";
import {
  extractTopicsHeuristic,
  extractTopicHierarchy,
  mapSingleQuestionToTopic,
  mapPastPaperQuestions,
  computeTopicExamWeights,
  buildTopicTree,
  type PaperQuestionInput,
} from "@/lib/algorithms/topic-mapper";
import { DEMO_TOPICS, DEMO_CHUNKS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";

describe("Unit: Topic Hierarchy & Past-Paper Mapping (topic-mapper.ts)", () => {
  describe("Topic Hierarchy Extraction", () => {
    const sampleSyllabusText = `
Unit 1: Process Management and Concurrency
* Processes and Threads: Process state transitions and PCB structures
* CPU Scheduling: Preemptive and non-preemptive algorithms including Round Robin
Unit 2: Memory Management
* Virtual Memory: Paging architecture and page tables
* Page Replacement: FIFO, LRU, and Optimal replacement strategies
`;

    it("should extract units, topics, and learning objectives", () => {
      const { topics, prerequisites } = extractTopicsHeuristic(sampleSyllabusText, DEMO_CHUNKS);

      expect(topics.length).toBeGreaterThanOrEqual(4);
      expect(topics[0].unitModule).toContain("Unit 1");
      expect(topics[0].learningObjectives.length).toBeGreaterThan(0);
      expect(prerequisites.length).toBeGreaterThanOrEqual(2);
      expect(prerequisites[0].isInferred).toBe(true);
    });

    it("should handle async extraction with fallback parsing", async () => {
      const result = await extractTopicHierarchy({
        syllabusText: sampleSyllabusText,
        chunks: DEMO_CHUNKS,
      });

      expect(result.topics.length).toBeGreaterThan(0);
      for (const t of result.topics) {
        expect(t.extractionConfidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe("Past-Paper Question Mapping", () => {
    it("should map question to correct syllabus topic with high confidence", () => {
      const question: PaperQuestionInput = {
        questionNumber: "Q1",
        questionText: "Calculate effective access time with a 90% TLB hit rate and page fault rate of 0.001.",
        marks: 8,
        documentId: "doc-1",
        workspaceId: "ws-1",
      };

      const mapped = mapSingleQuestionToTopic({
        question,
        topics: DEMO_TOPICS,
        chunks: DEMO_CHUNKS,
      });

      expect(mapped.mappedTopicId).toBeDefined();
      expect(mapped.mappingConfidence).toBeGreaterThanOrEqual(0.60);
      expect(mapped.needsReview).toBe(false);
      expect(mapped.mappingRationale).toContain("Matched syllabus topic");
    });

    it("should flag low confidence mapping (< 0.60) as needs_review = true", () => {
      const unrelatedQuestion: PaperQuestionInput = {
        questionNumber: "Q99",
        questionText: "Discuss the political economy of the 17th century Venetian merchant republic.",
        marks: 10,
        documentId: "doc-1",
        workspaceId: "ws-1",
      };

      const mapped = mapSingleQuestionToTopic({
        question: unrelatedQuestion,
        topics: DEMO_TOPICS,
        chunks: DEMO_CHUNKS,
      });

      expect(mapped.needsReview).toBe(true);
      expect(mapped.mappingConfidence).toBeLessThan(0.60);
      expect(mapped.mappingRationale).toContain("Needs human review");
    });

    it("should map a batch of past paper questions", () => {
      const questions: PaperQuestionInput[] = [
        {
          questionNumber: "Q1",
          questionText: "Explain Peterson's algorithm for mutual exclusion between two processes.",
          marks: 5,
          documentId: "doc-1",
          workspaceId: "ws-1",
        },
        {
          questionNumber: "Q2",
          questionText: "Describe demand paging and explain the steps in handling a page fault.",
          marks: 7,
          documentId: "doc-1",
          workspaceId: "ws-1",
        },
      ];

      const batch = mapPastPaperQuestions({
        questions,
        topics: DEMO_TOPICS,
        chunks: DEMO_CHUNKS,
      });

      expect(batch.length).toBe(2);
      expect(batch[0].mappedTopicId).toBeDefined();
      expect(batch[1].mappedTopicId).toBeDefined();
    });
  });

  describe("Topic Exam Weight Calculation", () => {
    it("should normalize exam weights across topics summing to 1.0", () => {
      const mockPaperQuestions = [
        {
          id: "pq-1",
          workspace_id: "ws-1",
          document_id: "doc-1",
          paper_year: 2023,
          paper_name: "Final",
          question_number: "Q1",
          question_text: "Text",
          marks: 20,
          mapped_topic_id: DEMO_TOPICS[0].id,
          mapping_confidence: 0.9,
          needs_review: false,
          supporting_chunk_id: null,
          mapping_rationale: "Rationale",
          created_at: new Date().toISOString(),
        },
        {
          id: "pq-2",
          workspace_id: "ws-1",
          document_id: "doc-1",
          paper_year: 2023,
          paper_name: "Final",
          question_number: "Q2",
          question_text: "Text",
          marks: 80,
          mapped_topic_id: DEMO_TOPICS[1].id,
          mapping_confidence: 0.9,
          needs_review: false,
          supporting_chunk_id: null,
          mapping_rationale: "Rationale",
          created_at: new Date().toISOString(),
        },
      ];

      const weights = computeTopicExamWeights(DEMO_TOPICS, mockPaperQuestions);

      expect(weights.get(DEMO_TOPICS[0].id)?.examWeight).toBe(0.20); // 20 / 100
      expect(weights.get(DEMO_TOPICS[1].id)?.examWeight).toBe(0.80); // 80 / 100

      const sumWeights = Array.from(weights.values()).reduce((sum, w) => sum + w.examWeight, 0);
      expect(sumWeights).toBeCloseTo(1.0, 4);
    });

    it("should return zero exam weight when no past paper questions exist", () => {
      const weights = computeTopicExamWeights(DEMO_TOPICS, []);
      for (const w of weights.values()) {
        expect(w.examWeight).toBe(0.0);
        expect(w.examFrequency).toBe(0);
      }
    });
  });

  describe("Topic Tree Hierarchy Generation", () => {
    it("should build hierarchical tree with prerequisites attached to nodes", () => {
      const tree = buildTopicTree(DEMO_TOPICS, DEMO_PREREQUISITES);

      expect(tree.length).toBeGreaterThan(0);
      const allNodes = tree.flatMap((r) => [r, ...(r.children || [])]);
      const nodeWithPrereqs = allNodes.find((n) => n.prerequisites && n.prerequisites.length > 0);
      expect(nodeWithPrereqs).toBeDefined();
    });
  });
});
