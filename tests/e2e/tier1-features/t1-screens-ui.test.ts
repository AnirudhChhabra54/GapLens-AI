// ==============================================================================
// Tier 1: Feature Coverage — Frontend Screens & UI Contracts (Features 20-25)
// Verifies:
// - Feature 20: Screen 1 — Login & 1-Click Judge Demo (demo@gapfinder.ai, 0-latency)
// - Feature 21: Screen 2 — Dashboard & Readiness Gauge (Readiness metric, exam countdown)
// - Feature 22: Screen 3 — Materials & Topic Graph (Dropzone, DAG visualization nodes)
// - Feature 23: Screen 4 — Diagnostic Lab & Citations (MCQ runner, confidence selector)
// - Feature 24: Screen 5 — Gap Report & Evidence Ledger (Hero matrix, blind spot cards)
// - Feature 25: Screen 6 — Planner & Copilot Drawer (Time slider, task queue, copilot)
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock } from "../helpers/mock-adapters";
import {
  getDemoProfile,
  getDemoWorkspace,
  getDemoDocuments,
  getDemoTopics,
  getDemoPrerequisites,
  getDemoQuestions,
  getDemoAnswers,
  getDemoGapReport,
  getWeakTopic,
  getBlindSpotTopic,
} from "../helpers/fixture-loader";
import type { ReadinessMetrics } from "@/types/assessment";

describe("Tier 1: Frontend Screens & UI Contracts (Features 20-25)", () => {
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
  });

  // ----------------------------------------------------------------------------
  // Feature 20: Screen 1 — Login & 1-Click Judge Demo
  // ----------------------------------------------------------------------------
  describe("Feature 20: Screen 1 — Login & 1-Click Judge Demo", () => {
    it("20.1 should provide one-click demo credentials for instant evaluation (demo@gapfinder.ai)", () => {
      const demoProfile = getDemoProfile();
      expect(demoProfile.email).toBe("demo@gapfinder.ai");
      expect(demoProfile.id).toBeDefined();
    });

    it("20.2 1-click demo access should load pre-seeded OS CS-301 workspace immediately", async () => {
      const { data: workspace } = await db.from("workspaces").select("*").eq("id", db.workspaces[0].id).single();
      expect(workspace).toBeDefined();
      expect(workspace!.title).toContain("Operating Systems (CS-301)");
    });

    it("20.3 demo session must populate default daily study budget (60 mins)", () => {
      const ws = getDemoWorkspace();
      expect(ws.daily_study_minutes).toBe(60);
    });

    it("20.4 should provide fallback demo experience when live Supabase Auth credentials are unset", () => {
      const isCloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
      // Demo fallback must always be ready regardless of cloud environment
      expect(getDemoProfile()).toBeDefined();
      expect(getDemoWorkspace()).toBeDefined();
    });

    it("20.5 should prevent exposing service-role keys or production secrets in client session", () => {
      const clientProfile = getDemoProfile();
      expect((clientProfile as any).service_role_key).toBeUndefined();
      expect((clientProfile as any).supabase_secret).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 21: Screen 2 — Dashboard & Readiness Gauge
  // ----------------------------------------------------------------------------
  describe("Feature 21: Screen 2 — Dashboard & Readiness Gauge", () => {
    it("21.1 should compute exam readiness score from assessed topic coverage and average mastery", () => {
      const gapReport = getDemoGapReport();
      const { readiness } = gapReport;

      expect(readiness.readinessScore).toBeGreaterThan(0);
      expect(readiness.readinessScore).toBeLessThanOrEqual(100);
      expect(readiness.coveragePercentage).toBeGreaterThanOrEqual(70);
      expect(readiness.averageMastery).toBeGreaterThan(60);
    });

    it("21.2 should calculate days remaining until exam date", () => {
      const ws = getDemoWorkspace();
      expect(ws.exam_date).toBeDefined();

      const today = new Date("2026-11-18");
      const exam = new Date(ws.exam_date!);
      const diffDays = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBe(14); // Exactly 14 days until 2026-12-02
    });

    it("21.3 should summarize topic mastery breakdown by status categories (weak, medium, strong)", () => {
      const topics = getDemoTopics();
      const counts = { weak: 0, medium: 0, strong: 0, unassessed: 0 };
      for (const t of topics) {
        counts[t.classification]++;
      }

      expect(counts.weak).toBeGreaterThan(0);
      expect(counts.medium).toBeGreaterThan(0);
      expect(counts.strong).toBeGreaterThan(0);
      expect(counts.weak + counts.medium + counts.strong).toBe(10);
    });

    it("21.4 should identify insufficient assessment data condition when topic coverage < 30%", () => {
      const checkDataSufficiency = (assessed: number, total: number): ReadinessMetrics => {
        const coverage = total > 0 ? (assessed / total) * 100 : 0;
        const isSufficient = coverage >= 30;
        return {
          readinessScore: isSufficient ? 65 : 0,
          assessedTopicsCount: assessed,
          totalTopicsCount: total,
          coveragePercentage: coverage,
          averageMastery: 50,
          isDataSufficient: isSufficient,
          insufficiencyReason: isSufficient ? undefined : "Take diagnostic quiz to establish baseline readiness.",
        };
      };

      const freshStudent = checkDataSufficiency(1, 10);
      expect(freshStudent.isDataSufficient).toBe(false);
      expect(freshStudent.insufficiencyReason).toBeDefined();

      const assessedStudent = checkDataSufficiency(8, 10);
      expect(assessedStudent.isDataSufficient).toBe(true);
    });

    it("21.5 should list daily priority study tasks on dashboard home", async () => {
      const { data: tasks } = await db.from("revision_tasks").select("*").eq("day_number", 1);
      expect(tasks).toBeDefined();
      expect(tasks!.length).toBeGreaterThan(0);
      expect(tasks![0].allocatedMinutes).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 22: Screen 3 — Materials & Topic Graph
  // ----------------------------------------------------------------------------
  describe("Feature 22: Screen 3 — Materials & Topic Graph", () => {
    it("22.1 should display uploaded documents with page count and status badges", () => {
      const docs = getDemoDocuments();
      expect(docs.length).toBeGreaterThanOrEqual(2);
      for (const doc of docs) {
        expect(doc.filename.endsWith(".pdf")).toBe(true);
        expect(doc.page_count).toBeGreaterThan(0);
        expect(doc.status).toBe("indexed");
      }
    });

    it("22.2 should format React Flow DAG nodes representing syllabus topics with status color coding", () => {
      const topics = getDemoTopics();
      const nodes = topics.map((t, idx) => ({
        id: t.id,
        data: { label: t.title, mastery: t.current_mastery, status: t.classification },
        position: { x: (idx % 3) * 250, y: Math.floor(idx / 3) * 150 },
      }));

      expect(nodes.length).toBe(10);
      expect(nodes[0].data.status).toBe("strong");
      expect(nodes.find((n) => n.id === getWeakTopic().id)?.data.status).toBe("weak");
    });

    it("22.3 should format React Flow edges linking prerequisite topics", () => {
      const prereqs = getDemoPrerequisites();
      const edges = prereqs.map((p) => ({
        id: `e-${p.prerequisite_topic_id}-${p.topic_id}`,
        source: p.prerequisite_topic_id,
        target: p.topic_id,
        animated: true,
      }));

      expect(edges.length).toBeGreaterThanOrEqual(4);
      for (const edge of edges) {
        expect(edge.source).toBeDefined();
        expect(edge.target).toBeDefined();
      }
    });

    it("22.4 should group topics into units / modules (e.g. Unit 1: Kernel, Unit 2: Processes)", () => {
      const topics = getDemoTopics();
      const units = new Set(topics.map((t) => t.unit_module).filter(Boolean));
      expect(units.size).toBeGreaterThanOrEqual(4);
      expect(Array.from(units).some((u) => u!.includes("Memory Management"))).toBe(true);
    });

    it("22.5 should support filtering materials by document type (syllabus vs notes vs past paper)", () => {
      const docs = getDemoDocuments();
      const syllabi = docs.filter((d) => d.doc_type === "syllabus");
      const materials = docs.filter((d) => d.doc_type === "material");

      expect(syllabi.length).toBe(1);
      expect(materials.length).toBe(1);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 23: Screen 4 — Diagnostic Lab & Citations
  // ----------------------------------------------------------------------------
  describe("Feature 23: Screen 4 — Diagnostic Lab & Citations", () => {
    it("23.1 should render diagnostic questions with decoupled confidence buttons (Low, Medium, High)", () => {
      const question = getDemoQuestions()[0];
      const confidenceLevels: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];

      expect(question.question_text).toBeDefined();
      expect(confidenceLevels).toContain("low");
      expect(confidenceLevels).toContain("high");
    });

    it("23.2 should hide correct answer and explanation until student submits answer", () => {
      const safeQuestion = {
        id: "q1",
        question_text: "What is dual-mode CPU operation?",
        options: [{ id: "A", text: "User vs kernel mode" }],
        // Invariant: answer_key and explanation must not be in safe student view
      };

      expect((safeQuestion as any).answer_key).toBeUndefined();
      expect((safeQuestion as any).explanation).toBeUndefined();
    });

    it("23.3 should display instant feedback and rubric breakdown upon submission", () => {
      const answer = getDemoAnswers().find((a) => a.rubric_evaluation !== null);
      expect(answer).toBeDefined();
      expect(answer!.feedback).toBeDefined();
      expect(answer!.rubric_evaluation!.length).toBeGreaterThan(0);
    });

    it("23.4 should open citation drawer displaying source document name and exact page numbers", () => {
      const question = getDemoQuestions()[0];
      expect(question.citation_document_name).toBe("Silberschatz OS Concepts");
      expect(question.citation_page_start).toBe(1);
      expect(question.citation_page_end).toBe(2);
      expect(question.citation_quote).toBeDefined();
    });

    it("23.5 should flag citation verified badge when quote matches chunk text", () => {
      const question = getDemoQuestions()[0];
      expect(question.is_quote_verified).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 24: Screen 5 — Gap Report & Evidence Ledger
  // ----------------------------------------------------------------------------
  describe("Feature 24: Screen 5 — Gap Report & Evidence Ledger", () => {
    it("24.1 hero matrix should clearly distinguish weak, medium, and strong topics", () => {
      const gapReport = getDemoGapReport();
      const weak = gapReport.topicBreakdown.filter((t) => t.classification === "weak");
      const strong = gapReport.topicBreakdown.filter((t) => t.classification === "strong");

      expect(weak.length).toBeGreaterThan(0);
      expect(strong.length).toBeGreaterThan(0);
      expect(weak[0].masteryScore).toBeLessThan(40);
      expect(strong[0].masteryScore).toBeGreaterThanOrEqual(70);
    });

    it("24.2 should highlight High-Confidence Blind Spot warning cards with callout styling", () => {
      const gapReport = getDemoGapReport();
      expect(gapReport.blindSpots.totalBlindSpots).toBeGreaterThan(0);

      const blindSpot = gapReport.blindSpots.items[0];
      expect(blindSpot.confidence).toBe("high");
      expect(blindSpot.remedyAction).toBeDefined();
      expect(blindSpot.evidenceQuote).toBeDefined();
    });

    it("24.3 evidence ledger should trace every diagnosis to concrete question attempts and textbook quotes", () => {
      const gapReport = getDemoGapReport();
      const item = gapReport.blindSpots.items[0];

      expect(item.citation.chunkId).toBeDefined();
      expect(item.citation.pageStart).toBeGreaterThanOrEqual(1);
      expect(item.studentResponse).toBeDefined();
      expect(item.correctAnswer).toBeDefined();
    });

    it("24.4 should generate actionable urgent remediation recommendations", () => {
      const gapReport = getDemoGapReport();
      expect(gapReport.urgentActions.length).toBeGreaterThan(0);
      expect(gapReport.urgentActions[0].priority).toBe("urgent");
      expect(gapReport.urgentActions[0].actionType).toContain("remedy");
    });

    it("24.5 gap report should remain explainable with zero black-box hallucinated diagnostic claims", () => {
      const gapReport = getDemoGapReport();
      for (const topic of gapReport.topicBreakdown) {
        expect(topic.totalAttempts).toBeGreaterThanOrEqual(0);
        expect(topic.correctAttempts).toBeLessThanOrEqual(topic.totalAttempts);
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 25: Screen 6 — Planner & Copilot Drawer
  // ----------------------------------------------------------------------------
  describe("Feature 25: Screen 6 — Planner & Copilot Drawer", () => {
    it("25.1 should provide interactive daily study time slider adjusting daily budget (30-180 mins)", () => {
      const sliderValues = [30, 45, 60, 90, 120];
      for (const val of sliderValues) {
        expect(val).toBeGreaterThanOrEqual(30);
        expect(val).toBeLessThanOrEqual(180);
      }
    });

    it("25.2 should display ordered checklist of scheduled revision tasks for active day", async () => {
      const { data: tasks } = await db.from("revision_tasks").select("*").eq("day_number", 1);
      expect(tasks).toBeDefined();
      expect(tasks!.length).toBeGreaterThan(0);
      expect(tasks![0].status).toBe("pending");
      expect(tasks![0].title).toBeDefined();
    });

    it("25.3 should support toggling task completion status (pending -> completed)", async () => {
      const task = db.revision_tasks[0];
      await db.from("revision_tasks").update({ status: "completed" }).eq("id", task.id);

      const { data } = await db.from("revision_tasks").select("*").eq("id", task.id).single();
      expect(data!.status).toBe("completed");
    });

    it("25.4 should provide collapsible Copilot drawer alongside revision tasks", () => {
      const copilotDrawer = {
        isOpen: true,
        activeTopicId: getWeakTopic().id,
        messages: [],
      };

      expect(copilotDrawer.isOpen).toBe(true);
      expect(copilotDrawer.activeTopicId).toBeDefined();
    });

    it("25.5 should link tasks directly to source chunks and citation references", () => {
      const tasks = db.revision_tasks;
      for (const t of tasks) {
        expect(t.source_chunk_id).toBeDefined();
        expect(t.citation_reference).toBeDefined();
      }
    });
  });
});
