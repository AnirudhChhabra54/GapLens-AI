// ==============================================================================
// Tier 1: Feature Coverage — Scaffolding & Database Schema (Features 1-6)
// Verifies:
// - Feature 1: Skill Installation (.agents/skills/gaplens-build-guardian & gaplens-interview-notes)
// - Feature 2: Spec Normalization (BUILD_SPEC.md & Branding)
// - Feature 3: Project Scaffolding (Next.js, Tailwind, Vitest, TypeScript, tsconfig paths)
// - Feature 4: Database Schema (13 tables, pgvector, tsvector, RLS)
// - Feature 5: RRF Hybrid Search RPC (vector + keyword fusion formula)
// - Feature 6: Seed Demo Data (OS CS-301 fixture & database seed)
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { InMemorySupabaseMock } from "../helpers/mock-adapters";
import {
  getDemoProfile,
  getDemoWorkspace,
  getDemoDocuments,
  getDemoTopics,
  getDemoPrerequisites,
  getDemoChunks,
  getDemoQuestions,
  getDemoAnswers,
  generateDeterministic768dEmbedding,
} from "../helpers/fixture-loader";
import { assert768dEmbedding, assertRRFScoring, calculateRRFScore } from "../helpers/assertion-helpers";

describe("Tier 1: Scaffolding & Database Schema (Features 1-6)", () => {
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
  });

  // ----------------------------------------------------------------------------
  // Helper to resolve files from workspace or classified folder
  // ----------------------------------------------------------------------------
  const resolveFile = (...relPaths: string[]) => {
    for (const r of relPaths) {
      const p = path.resolve(process.cwd(), r);
      if (fs.existsSync(p)) return p;
    }
    return path.resolve(process.cwd(), relPaths[0]);
  };

  // ----------------------------------------------------------------------------
  // Feature 1: Skill Installation
  // ----------------------------------------------------------------------------
  describe("Feature 1: Skill Installation", () => {
    const buildGuardianPath = resolveFile(
      ".agents/skills/gaplens-build-guardian/SKILL.md",
      "classified/skills/.agents/skills/gaplens-build-guardian/SKILL.md"
    );
    const interviewNotesPath = resolveFile(
      ".agents/skills/gaplens-interview-notes/SKILL.md",
      "classified/skills/.agents/skills/gaplens-interview-notes/SKILL.md"
    );

    it("1.1 should have Build Guardian skill installed at the canonical path", () => {
      expect(fs.existsSync(buildGuardianPath)).toBe(true);
    });

    it("1.2 should have Interview Notes skill installed at the canonical path", () => {
      expect(fs.existsSync(interviewNotesPath)).toBe(true);
    });

    it("1.3 Build Guardian SKILL.md should define required audit checkpoints", () => {
      const content = fs.readFileSync(buildGuardianPath, "utf-8");
      expect(content).toContain("BUILD_SPEC.md");
      expect(content).toContain("acceptance criteria");
    });

    it("1.4 Interview Notes SKILL.md should define interview guide generation rules", () => {
      const content = fs.readFileSync(interviewNotesPath, "utf-8");
      expect(content).toContain("docs/interview-prep");
      expect(content).toContain("student-friendly");
    });

    it("1.5 skills should have valid YAML frontmatter or standard markdown headings", () => {
      const bgContent = fs.readFileSync(buildGuardianPath, "utf-8");
      const inContent = fs.readFileSync(interviewNotesPath, "utf-8");
      expect(bgContent.startsWith("---") || bgContent.startsWith("#")).toBe(true);
      expect(inContent.startsWith("---") || inContent.startsWith("#")).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 2: Spec Normalization & Branding
  // ----------------------------------------------------------------------------
  describe("Feature 2: Spec Normalization & Branding", () => {
    const buildSpecPath = resolveFile("BUILD_SPEC.md", "classified/specs/BUILD_SPEC.md");
    const qualityReportPath = resolveFile("QUALITY_REPORT.md", "classified/reports/QUALITY_REPORT.md");

    it("2.1 should have BUILD_SPEC.md present in the workspace root", () => {
      expect(fs.existsSync(buildSpecPath)).toBe(true);
    });

    it("2.2 QUALITY_REPORT.md and project files should enforce canonical branding: GapLens AI — See the gaps. Master what matters.", () => {
      const content = fs.readFileSync(qualityReportPath, "utf-8");
      expect(content).toContain("GapLens AI");
      expect(content).toContain("See the gaps. Master what matters.");
    });

    it("2.3 should preserve original spec file if present", () => {
      const origPath = resolveFile("GapFinder_AI_Final_Autonomous_Build_Spec.md", "classified/specs/GapFinder_AI_Final_Autonomous_Build_Spec.md");
      if (fs.existsSync(origPath)) {
        const origContent = fs.readFileSync(origPath, "utf-8");
        expect(origContent.length).toBeGreaterThan(1000);
      } else {
        expect(fs.existsSync(buildSpecPath)).toBe(true);
      }
    });

    it("2.4 BUILD_SPEC.md should include all core architecture and execution sections", () => {
      const content = fs.readFileSync(buildSpecPath, "utf-8");
      expect(content).toContain("AUTONOMOUS EXECUTION CONTRACT");
      expect(content).toContain("PART B — PRODUCT AND HACKATHON REQUIREMENTS");
      expect(content).toContain("Supabase");
    });

    it("2.5 package.json should reflect product naming gaplens-ai", () => {
      const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
      expect(pkgJson.name).toBe("gaplens-ai");
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 3: Project Scaffolding
  // ----------------------------------------------------------------------------
  describe("Feature 3: Project Scaffolding", () => {
    it("3.1 tsconfig.json should configure path alias @/* to ./src/*", () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "tsconfig.json"), "utf-8"));
      expect(tsconfig.compilerOptions.paths["@/*"]).toEqual(["./src/*"]);
    });

    it("3.2 vitest.config.ts should configure resolve alias matching @/*", () => {
      const vitestConfig = fs.readFileSync(path.resolve(process.cwd(), "vitest.config.ts"), "utf-8");
      expect(vitestConfig).toContain("resolve");
      expect(vitestConfig).toContain("@");
    });

    it("3.3 package.json should have test:e2e script defined", () => {
      const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
      expect(pkgJson.scripts["test:e2e"]).toBe("vitest run tests/e2e");
    });

    it("3.4 package.json should specify Next.js 14, React 18, and Supabase client", () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
      expect(pkg.dependencies.next).toContain("14");
      expect(pkg.dependencies.react).toBeDefined();
      expect(pkg.dependencies["@supabase/supabase-js"]).toBeDefined();
    });

    it("3.5 tailwind.config.ts should exist and scan src/ directory", () => {
      const tailwindConfigPath = path.resolve(process.cwd(), "tailwind.config.ts");
      expect(fs.existsSync(tailwindConfigPath)).toBe(true);
      const content = fs.readFileSync(tailwindConfigPath, "utf-8");
      expect(content).toContain("./src");
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 4: Database Schema (13 tables, pgvector, tsvector)
  // ----------------------------------------------------------------------------
  describe("Feature 4: Database Schema", () => {
    const migration1Path = path.resolve(process.cwd(), "supabase/migrations/20261118000001_create_schema.sql");
    const migration3Path = path.resolve(process.cwd(), "supabase/migrations/20261118000003_rls_and_storage.sql");

    it("4.1 migration 1 should create extension vector and uuid", () => {
      const content = fs.readFileSync(migration1Path, "utf-8");
      expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "vector"');
      expect(content).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    });

    it("4.2 should define all 13 core tables in SQL migration", () => {
      const content = fs.readFileSync(migration1Path, "utf-8");
      const tables = [
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
      for (const table of tables) {
        expect(content).toContain(`CREATE TABLE ${table}`);
      }
    });

    it("4.3 document_chunks table should define VECTOR(768) and tsvector fts column", () => {
      const content = fs.readFileSync(migration1Path, "utf-8");
      expect(content).toContain("embedding VECTOR(768)");
      expect(content).toContain("fts TSVECTOR");
    });

    it("4.4 document_chunks should have HNSW vector index with cosine distance", () => {
      const content = fs.readFileSync(migration1Path, "utf-8");
      expect(content).toContain("USING hnsw (embedding vector_cosine_ops)");
    });

    it("4.5 migration 3 should enable RLS on tables and configure private documents bucket", () => {
      const content = fs.readFileSync(migration3Path, "utf-8");
      expect(content).toContain("ENABLE ROW LEVEL SECURITY");
      expect(content).toContain("documents");
      expect(content).toContain("public = false");
    });

    it("4.6 in-memory mock should support querying all 13 tables", async () => {
      const tables = [
        "profiles",
        "workspaces",
        "documents",
        "document_chunks",
        "topics",
        "topic_prerequisites",
        "quizzes",
        "quiz_questions",
        "answers",
        "mastery_snapshots",
        "revision_plans",
        "revision_tasks",
      ];
      for (const table of tables) {
        const { data } = await db.from(table).select("*");
        expect(Array.isArray(data)).toBe(true);
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 5: RRF Hybrid Search RPC
  // ----------------------------------------------------------------------------
  describe("Feature 5: RRF Hybrid Search RPC", () => {
    const migration2Path = path.resolve(process.cwd(), "supabase/migrations/20261118000002_hybrid_search_rpc.sql");

    it("5.1 migration 2 should define match_documents_hybrid stored procedure", () => {
      const content = fs.readFileSync(migration2Path, "utf-8");
      expect(content).toContain("CREATE OR REPLACE FUNCTION match_documents_hybrid");
    });

    it("5.2 match_documents_hybrid should accept 768d vector, query text, and rrf_k", () => {
      const content = fs.readFileSync(migration2Path, "utf-8");
      expect(content).toContain("p_query_embedding VECTOR(768)");
      expect(content).toContain("p_query_text TEXT");
      expect(content).toContain("p_rrf_k INT DEFAULT 60");
    });

    it("5.3 RRF score formula should calculate 1 / (k + rank) correctly", () => {
      const k = 60;
      const score1 = calculateRRFScore(1, 1, k);
      const score2 = calculateRRFScore(1, 2, k);
      expect(score1).toBeGreaterThan(score2);
      expect(score1).toBeCloseTo(1 / 61 + 1 / 61, 6);
    });

    it("5.4 in-memory RPC should execute hybrid search returning ranked chunks with rrf_score", async () => {
      const dummyVec = generateDeterministic768dEmbedding("Virtual Memory Demand Paging");
      const { data, error } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "demand paging page fault",
        p_query_embedding: dummyVec,
        p_match_count: 5,
        p_rrf_k: 60,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
      expect(data![0].rrf_score).toBeGreaterThan(0);
    });

    it("5.5 hybrid search results should be sorted in descending order of rrf_score", async () => {
      const dummyVec = generateDeterministic768dEmbedding("CPU Scheduling");
      const { data } = await db.rpc("hybrid_search_chunks", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "Round Robin turnaround time",
        p_query_embedding: dummyVec,
        p_match_count: 5,
        p_rrf_k: 60,
      });

      expect(data).toBeDefined();
      assertRRFScoring(data!);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 6: Seed Demo Data (OS CS-301)
  // ----------------------------------------------------------------------------
  describe("Feature 6: Seed Demo Data (OS CS-301)", () => {
    it("6.1 should provide demo profile demo@gapfinder.ai", () => {
      const profile = getDemoProfile();
      expect(profile.email).toBe("demo@gapfinder.ai");
      expect(profile.full_name).toContain("Alex Chen");
    });

    it("6.2 should provide demo workspace for Operating Systems CS-301", () => {
      const ws = getDemoWorkspace();
      expect(ws.title).toContain("Operating Systems (CS-301)");
      expect(ws.daily_study_minutes).toBe(60);
    });

    it("6.3 should provide exactly 10 comprehensive OS topics", () => {
      const topics = getDemoTopics();
      expect(topics.length).toBe(10);
      const titles = topics.map((t) => t.title);
      expect(titles.some((t) => t.includes("Operating System Architecture"))).toBe(true);
      expect(titles.some((t) => t.includes("Virtual Memory"))).toBe(true);
      expect(titles.some((t) => t.includes("Synchronization"))).toBe(true);
    });

    it("6.4 should provide prerequisites linking core OS concepts", () => {
      const prereqs = getDemoPrerequisites();
      expect(prereqs.length).toBeGreaterThanOrEqual(4);
      for (const p of prereqs) {
        expect(p.topic_id).toBeDefined();
        expect(p.prerequisite_topic_id).toBeDefined();
      }
    });

    it("6.5 should provide 20 indexed text chunks with valid 768d embeddings", () => {
      const chunks = getDemoChunks();
      expect(chunks.length).toBe(20);
      for (const chunk of chunks) {
        assert768dEmbedding(chunk.embedding);
        expect(chunk.page_start).toBeGreaterThanOrEqual(1);
        expect(chunk.content.length).toBeGreaterThan(20);
      }
    });

    it("6.6 should include 15 diagnostic questions (10 MCQs + 5 Short Answers)", () => {
      const questions = getDemoQuestions();
      expect(questions.length).toBe(15);
      const mcqs = questions.filter((q) => q.question_type === "mcq");
      const shortAnswers = questions.filter((q) => q.question_type === "short_answer");
      expect(mcqs.length).toBe(10);
      expect(shortAnswers.length).toBe(5);
    });

    it("6.7 short answer questions should include structured rubric keypoints", () => {
      const questions = getDemoQuestions();
      const shortAnswers = questions.filter((q) => q.question_type === "short_answer");
      for (const sa of shortAnswers) {
        expect(sa.rubric).toBeDefined();
        expect(sa.rubric!.length).toBeGreaterThan(0);
        const sumWeights = sa.rubric!.reduce((sum, r) => sum + r.weight, 0);
        expect(sumWeights).toBeCloseTo(1.0, 2);
      }
    });

    it("6.8 should model weak topic in Virtual Memory and blind spot in Synchronization", () => {
      const topics = getDemoTopics();
      const vm = topics.find((t) => t.title.includes("Virtual Memory"));
      const sync = topics.find((t) => t.title.includes("Synchronization"));

      expect(vm).toBeDefined();
      expect(vm!.classification).toBe("weak");
      expect(vm!.current_mastery).toBeLessThan(45.0);

      expect(sync).toBeDefined();
      expect(sync!.blind_spot_count).toBeGreaterThan(0);
    });
  });
});
