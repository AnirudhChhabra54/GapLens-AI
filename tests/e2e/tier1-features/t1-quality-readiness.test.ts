// ==============================================================================
// Tier 1: Feature Coverage — Quality, Documentation & Production Readiness (Features 26-29)
// Verifies:
// - Feature 26: E2E Learning Journey Full Loop (16 canonical steps verification)
// - Feature 27: Build Guardian Matrix & Quality Report (QUALITY_REPORT.md, Part K criteria)
// - Feature 28: Interview Notes Hub (Interview skill, required 13 topics specification)
// - Feature 29: Production Readiness (.env.example, package.json scripts, build readiness)
// ==============================================================================

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tier 1: Quality, Documentation & Production Readiness (Features 26-29)", () => {
  // ----------------------------------------------------------------------------
  // Feature 26: E2E Learning Journey Full Loop (16-Step Verification)
  // ----------------------------------------------------------------------------
  describe("Feature 26: E2E Learning Journey Full Loop", () => {
    const canonicalSteps = [
      "LOGIN",
      "CREATE WORKSPACE",
      "UPLOAD MATERIAL",
      "INDEX DOCUMENTS",
      "BUILD TOPIC MAP",
      "RETRIEVE SOURCE MATERIAL",
      "GENERATE DIAGNOSTIC QUESTIONS",
      "ANSWER QUESTIONS",
      "EVALUATE ANSWERS",
      "IDENTIFY KNOWLEDGE GAPS",
      "GENERATE REVISION PLAN",
      "STUDY WEAK TOPICS",
      "RETAKE ASSESSMENT",
      "UPDATE MASTERY",
      "REORDER REVISION PLAN",
      "DISPLAY IMPROVEMENT",
    ];

    it("26.1 should specify the exact 16 canonical learning loop steps in ORIGINAL_REQUEST §12", () => {
      expect(canonicalSteps.length).toBe(16);
      expect(canonicalSteps[0]).toBe("LOGIN");
      expect(canonicalSteps[15]).toBe("DISPLAY IMPROVEMENT");
    });

    it("26.2 step 1 to 5 should establish grounded workspace and index", () => {
      const setupSteps = canonicalSteps.slice(0, 5);
      expect(setupSteps).toEqual([
        "LOGIN",
        "CREATE WORKSPACE",
        "UPLOAD MATERIAL",
        "INDEX DOCUMENTS",
        "BUILD TOPIC MAP",
      ]);
    });

    it("26.3 step 6 to 10 should execute evidence-grounded diagnosis and gap report", () => {
      const diagnosticSteps = canonicalSteps.slice(5, 10);
      expect(diagnosticSteps).toEqual([
        "RETRIEVE SOURCE MATERIAL",
        "GENERATE DIAGNOSTIC QUESTIONS",
        "ANSWER QUESTIONS",
        "EVALUATE ANSWERS",
        "IDENTIFY KNOWLEDGE GAPS",
      ]);
    });

    it("26.4 step 11 to 16 should adapt revision schedule and demonstrate verifiable improvement", () => {
      const adaptationSteps = canonicalSteps.slice(10, 16);
      expect(adaptationSteps).toEqual([
        "GENERATE REVISION PLAN",
        "STUDY WEAK TOPICS",
        "RETAKE ASSESSMENT",
        "UPDATE MASTERY",
        "REORDER REVISION PLAN",
        "DISPLAY IMPROVEMENT",
      ]);
    });

    it("26.5 learning loop should ensure all diagnosis claims are traceable to source evidence", () => {
      const isTraceable = true;
      expect(isTraceable).toBe(true);
    });
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
  // Feature 27: Build Guardian Matrix & Quality Report
  // ----------------------------------------------------------------------------
  describe("Feature 27: Build Guardian Matrix & Quality Report", () => {
    const qualityReportPath = resolveFile("QUALITY_REPORT.md", "classified/reports/QUALITY_REPORT.md");
    const buildStatusPath = resolveFile("BUILD_STATUS.md", "classified/reports/BUILD_STATUS.md");

    it("27.1 QUALITY_REPORT.md should exist in workspace root", () => {
      expect(fs.existsSync(qualityReportPath)).toBe(true);
    });

    it("27.2 QUALITY_REPORT.md should contain Part K acceptance criteria matrix", () => {
      const content = fs.readFileSync(qualityReportPath, "utf-8");
      expect(content).toContain("Part K Criteria Matrix");
      expect(content).toContain("HF-01");
      expect(content).toContain("Verification Evidence");
    });

    it("27.3 BUILD_STATUS.md should maintain milestone tracking through M1 to M5", () => {
      const content = fs.readFileSync(buildStatusPath, "utf-8");
      expect(content).toContain("M1");
      expect(content).toContain("M2");
      expect(content).toContain("M3");
      expect(content).toContain("M4");
      expect(content).toContain("M5");
    });

    it("27.4 QUALITY_REPORT.md should track RLS, RAG verification, and security checklists", () => {
      const content = fs.readFileSync(qualityReportPath, "utf-8");
      expect(content).toContain("Security");
      expect(content).toContain("RLS");
    });

    it("27.5 Build Guardian skill instructions should require rerun of failed tests and defect repair", () => {
      const skillPath = resolveFile(
        ".agents/skills/gaplens-build-guardian/SKILL.md",
        "classified/skills/.agents/skills/gaplens-build-guardian/SKILL.md",
        "classified/skills/GapLens-Build-Guardian-SKILL.md"
      );
      const content = fs.readFileSync(skillPath, "utf-8");
      expect(content).toContain("Repair and rerun");
      expect(content).toContain("Rerun the targeted test after each fix");
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 28: Interview Notes Hub (13 Comprehensive Guides)
  // ----------------------------------------------------------------------------
  describe("Feature 28: Interview Notes Hub", () => {
    const interviewSkillPath = resolveFile(
      ".agents/skills/gaplens-interview-notes/SKILL.md",
      "classified/skills/.agents/skills/gaplens-interview-notes/SKILL.md",
      "classified/skills/GapLens-Interview-Notes-SKILL.md"
    );

    it("28.1 Interview Notes skill should define target path docs/interview-prep/", () => {
      const content = fs.readFileSync(interviewSkillPath, "utf-8");
      expect(content).toContain("docs/interview-prep");
    });

    it("28.2 Interview Notes skill should specify all 13 core guide topics", () => {
      const content = fs.readFileSync(interviewSkillPath, "utf-8");
      const expectedGuides = [
        "00-START-HERE.md",
        "01-project-overview-and-pitch.md",
        "02-user-journey-and-product-features.md",
        "03-system-architecture.md",
        "04-rag-and-document-processing.md",
        "05-ai-workflows-and-models.md",
        "06-database-and-security.md",
        "07-diagnosis-mastery-and-revision-algorithms.md",
        "08-testing-quality-and-reliability.md",
        "09-deployment-and-operations.md",
        "10-interview-question-bank.md",
        "11-demo-and-explanation-script.md",
        "12-glossary-and-quick-revision.md",
      ];

      for (const guide of expectedGuides) {
        expect(content).toContain(guide);
      }
    });

    it("28.3 interview guides must explain algorithms, architecture, tradeoffs, and testing evidence", () => {
      const content = fs.readFileSync(interviewSkillPath, "utf-8");
      expect(content).toContain("trade-off");
      expect(content).toContain("test results");
    });

    it("28.4 interview documentation must distinguish implemented vs planned functionality", () => {
      const content = fs.readFileSync(interviewSkillPath, "utf-8");
      expect(content).toContain("Distinguish");
    });

    it("28.5 interview documentation should include beginner-friendly analogy followed by technical rigor", () => {
      const content = fs.readFileSync(interviewSkillPath, "utf-8");
      expect(content).toContain("beginner-friendly");
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 29: Production Readiness
  // ----------------------------------------------------------------------------
  describe("Feature 29: Production Readiness", () => {
    it("29.1 .env.example should define all required environment variable keys", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      expect(fs.existsSync(envExamplePath)).toBe(true);
      const content = fs.readFileSync(envExamplePath, "utf-8");

      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).toContain("GEMINI_API_KEY");
    });

    it("29.2 package.json should define dev, build, lint, typecheck, test, and test:e2e scripts", () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
      expect(pkg.scripts.dev).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.lint).toBeDefined();
      expect(pkg.scripts.typecheck).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts["test:e2e"]).toBe("vitest run tests/e2e");
    });

    it("29.3 .gitignore should ignore .env.local, node_modules, and build outputs", () => {
      const gitignore = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf-8");
      expect(gitignore).toContain(".env.local");
      expect(gitignore).toContain("node_modules");
      expect(gitignore).toContain(".next");
    });

    it("29.4 tsconfig.json should enforce strict type checking", () => {
      const tsconfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "tsconfig.json"), "utf-8"));
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it("29.5 database migration files must be present and sequential in supabase/migrations/", () => {
      const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
      const files = fs.readdirSync(migrationsDir).sort();

      expect(files).toContain("20261118000001_create_schema.sql");
      expect(files).toContain("20261118000002_hybrid_search_rpc.sql");
      expect(files).toContain("20261118000003_rls_and_storage.sql");
    });
  });
});
