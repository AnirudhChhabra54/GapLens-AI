import { describe, it, expect } from "vitest";
import {
  DEMO_PROFILE,
  DEMO_WORKSPACE,
  DEMO_DOCUMENTS,
  DEMO_CHUNKS,
  DEMO_TOPICS,
  DEMO_PREREQUISITES,
  DEMO_PAPER_QUESTIONS,
  DEMO_QUIZZES,
  DEMO_QUIZ_QUESTIONS,
  DEMO_ANSWERS,
  DEMO_MASTERY_SNAPSHOTS,
  DEMO_REVISION_PLAN,
  DEMO_REVISION_TASKS,
  DEMO_GAP_REPORT,
  DEMO_REVISION_SCHEDULE,
  MOCK_768_EMBEDDING,
} from "@/lib/demo/os-cs301-fixture";
import fs from "fs";
import path from "path";

describe("Milestone 1 — Pre-Seeded OS CS-301 Demo Fixture Verification", () => {
  it("should have valid user profile and workspace configuration", () => {
    expect(DEMO_PROFILE.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(DEMO_PROFILE.email).toBe("demo@gapfinder.ai");
    expect(DEMO_WORKSPACE.id).toBe("10000000-0000-0000-0000-000000000001");
    expect(DEMO_WORKSPACE.user_id).toBe(DEMO_PROFILE.id);
    expect(DEMO_WORKSPACE.title).toBe("Operating Systems (CS-301)");
    expect(DEMO_WORKSPACE.daily_study_minutes).toBe(60);
  });

  it("should have indexed documents covering syllabus, notes, and past exams", () => {
    expect(DEMO_DOCUMENTS.length).toBe(4);
    const docTypes = DEMO_DOCUMENTS.map((d) => d.doc_type);
    expect(docTypes).toContain("syllabus");
    expect(docTypes).toContain("material");
    expect(docTypes).toContain("past_paper");
    for (const doc of DEMO_DOCUMENTS) {
      expect(doc.status).toBe("indexed");
      expect(doc.workspace_id).toBe(DEMO_WORKSPACE.id);
      expect(doc.page_count).toBeGreaterThan(0);
    }
  });

  it("should have realistic document chunks with exactly 768-dimensional embeddings", () => {
    expect(DEMO_CHUNKS.length).toBeGreaterThanOrEqual(5);
    expect(MOCK_768_EMBEDDING.length).toBe(768);

    for (const chunk of DEMO_CHUNKS) {
      expect(chunk.embedding.length).toBe(768);
      expect(chunk.embedding_dimensions).toBe(768);
      expect(chunk.embedding_model).toBe("gemini-embedding-001");
      expect(chunk.page_start).toBeGreaterThanOrEqual(1);
      expect(chunk.page_end).toBeGreaterThanOrEqual(chunk.page_start);
      expect(chunk.content.length).toBeGreaterThan(50);
      expect(chunk.section_heading).toBeTruthy();
    }
  });

  it("should maintain a hierarchical topic structure and valid prerequisite relationships", () => {
    const modules = DEMO_TOPICS.filter((t) => t.parent_id === null);
    const subtopics = DEMO_TOPICS.filter((t) => t.parent_id !== null);

    expect(modules.length).toBe(4);
    expect(subtopics.length).toBe(6);

    // Verify subtopics reference valid parents
    for (const sub of subtopics) {
      const parent = modules.find((m) => m.id === sub.parent_id);
      expect(parent).toBeDefined();
    }

    // Verify prerequisite graph references valid topic IDs
    expect(DEMO_PREREQUISITES.length).toBe(3);
    for (const prereq of DEMO_PREREQUISITES) {
      const topic = DEMO_TOPICS.find((t) => t.id === prereq.topic_id);
      const target = DEMO_TOPICS.find((t) => t.id === prereq.prerequisite_topic_id);
      expect(topic).toBeDefined();
      expect(target).toBeDefined();
      expect(prereq.confidence).toBeGreaterThan(0);
    }
  });

  it("should have past exam questions mapped to topics with realistic confidence scores", () => {
    expect(DEMO_PAPER_QUESTIONS.length).toBeGreaterThanOrEqual(3);
    for (const q of DEMO_PAPER_QUESTIONS) {
      expect(q.mapping_confidence).toBeGreaterThanOrEqual(0.9);
      expect(q.marks).toBeGreaterThan(0);
      const mappedTopic = DEMO_TOPICS.find((t) => t.id === q.mapped_topic_id);
      expect(mappedTopic).toBeDefined();
      if (q.supporting_chunk_id) {
        const chunk = DEMO_CHUNKS.find((c) => c.id === q.supporting_chunk_id);
        expect(chunk).toBeDefined();
      }
    }
  });

  it("should exhibit High-Confidence Blind Spots in student quiz answers", () => {
    expect(DEMO_ANSWERS.length).toBe(3);
    const blindSpots = DEMO_ANSWERS.filter((a) => a.is_blind_spot);

    // There should be exactly 2 blind spots (Peterson's Algorithm & TLB Miss)
    expect(blindSpots.length).toBe(2);

    for (const bs of blindSpots) {
      expect(bs.confidence).toBe("high");
      expect(bs.is_correct).toBe(false);
      expect(bs.feedback).toContain("HIGH CONFIDENCE BLIND SPOT");
    }

    // One answer should be correct with high confidence (Not a blind spot)
    const correctAnswers = DEMO_ANSWERS.filter((a) => a.is_correct);
    expect(correctAnswers.length).toBe(1);
    expect(correctAnswers[0].confidence).toBe("high");
    expect(correctAnswers[0].is_blind_spot).toBe(false);
  });

  it("should verify citation pinning and quote verification integrity", () => {
    for (const question of DEMO_QUIZ_QUESTIONS) {
      expect(question.is_quote_verified).toBe(true);
      expect(question.citation_quote).toBeTruthy();
      expect(question.citation_document_name).toBe("Silberschatz_OS_Concepts_Core_Notes.pdf");

      // Verify that the citation quote is actually contained in the source chunk content
      const chunk = DEMO_CHUNKS.find((c) => c.id === question.source_chunk_id);
      expect(chunk).toBeDefined();
      if (chunk && question.citation_quote) {
        const normalizedQuote = question.citation_quote.replace(/\s+/g, " ").trim();
        const normalizedContent = chunk.content.replace(/\s+/g, " ").trim();
        // Substring check
        expect(normalizedContent).toContain(normalizedQuote);
      }
    }
  });

  it("should strictly respect the daily study time budget in revision schedules", () => {
    const dailyBudget = DEMO_REVISION_PLAN.daily_minutes;
    expect(dailyBudget).toBe(60);

    for (const day of DEMO_REVISION_SCHEDULE.days) {
      expect(day.availableMinutes).toBe(dailyBudget);
      expect(day.allocatedMinutes).toBeLessThanOrEqual(dailyBudget);

      const sumMinutes = day.tasks.reduce((sum, t) => sum + t.allocatedMinutes, 0);
      expect(sumMinutes).toBe(day.allocatedMinutes);
      expect(sumMinutes).toBeLessThanOrEqual(dailyBudget);
    }
  });

  it("should match Gap Report metrics with topics and blind spots", () => {
    expect(DEMO_GAP_REPORT.blindSpots.totalBlindSpots).toBe(2);
    expect(DEMO_GAP_REPORT.blindSpots.items.length).toBe(2);
    expect(DEMO_GAP_REPORT.topics.length).toBe(6);
    expect(DEMO_GAP_REPORT.readiness.isDataSufficient).toBe(true);
    expect(DEMO_GAP_REPORT.readiness.assessedTopicsCount).toBe(3);
  });
});

describe("Milestone 1 — Supabase SQL Migration Files Verification", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

  it("should contain all three required migration files", () => {
    const files = fs.readdirSync(migrationsDir);
    expect(files).toContain("20261118000001_create_schema.sql");
    expect(files).toContain("20261118000002_hybrid_search_rpc.sql");
    expect(files).toContain("20261118000003_rls_and_storage.sql");
  });

  it("should define all 13 required tables in 20261118000001_create_schema.sql", () => {
    const sql = fs.readFileSync(path.join(migrationsDir, "20261118000001_create_schema.sql"), "utf-8");
    const requiredTables = [
      "profiles",
      "workspaces",
      "documents",
      "document_chunks",
      "topics",
      "topic_prerequisites",
      "paper_questions",
      "quizzes",
      "quiz_questions",
      "answers",
      "mastery_snapshots",
      "revision_plans",
      "revision_tasks",
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE\\s+${table}\\b`, "i"));
    }

    expect(sql).toContain("VECTOR(768)");
    expect(sql).toContain("vector_cosine_ops");
    expect(sql).toContain("to_tsvector('english', content)");
  });

  it("should define the match_documents_hybrid RRF function in 20261118000002_hybrid_search_rpc.sql", () => {
    const sql = fs.readFileSync(path.join(migrationsDir, "20261118000002_hybrid_search_rpc.sql"), "utf-8");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION match_documents_hybrid");
    expect(sql).toContain("p_query_embedding VECTOR(768)");
    expect(sql).toContain("p_rrf_k INT DEFAULT 60");
    expect(sql).toContain("rrf_score FLOAT");
  });

  it("should enable RLS on all 13 tables in 20261118000003_rls_and_storage.sql", () => {
    const sql = fs.readFileSync(path.join(migrationsDir, "20261118000003_rls_and_storage.sql"), "utf-8");
    const requiredTables = [
      "profiles",
      "workspaces",
      "documents",
      "document_chunks",
      "topics",
      "topic_prerequisites",
      "paper_questions",
      "quizzes",
      "quiz_questions",
      "answers",
      "mastery_snapshots",
      "revision_plans",
      "revision_tasks",
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(new RegExp(`ALTER TABLE\\s+${table}\\s+ENABLE ROW LEVEL SECURITY`, "i"));
    }

    expect(sql).toContain("storage.buckets");
    expect(sql).toContain("'documents'");
  });
});
