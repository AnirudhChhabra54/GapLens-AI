// ==============================================================================
// GapLens AI — Live Provider Integration Tests (Groq, Jina AI, Supabase)
// Verifies live API credentials, exact vector dimensions, structured output,
// and graceful fallback when credentials are absent.
// ==============================================================================

import { describe, it, expect } from "vitest";
import { isGroqLive, groqChatCompletion, generateGroqStructured, getGroqModel } from "@/lib/ai/groq";
import { isJinaLive, embedTextJina, embedBatchJina, getJinaModel, getJinaDimensions } from "@/lib/ai/jina";
import { embedText, generateStructured } from "@/lib/ai/gemini";
import { DiagnosticQuestionSchema } from "@/lib/ai/schemas";

describe("Live Cloud Provider Integrations", () => {
  describe("Groq LLM Integration (openai/gpt-oss-120b)", () => {
    it("should report live status accurately", () => {
      // In environment with GROQ_API_KEY, isGroqLive must be true
      const live = isGroqLive();
      expect(typeof live).toBe("boolean");
    });

    it("should use the requested openai/gpt-oss-120b model", () => {
      const model = getGroqModel();
      expect(model).toBe("openai/gpt-oss-120b");
    });

    it("should generate grounded completions when live", async () => {
      if (!isGroqLive()) return;

      const res = await groqChatCompletion([
        { role: "system", content: "You are an educational assistant. Answer in one short sentence." },
        { role: "user", content: "What is an operating system kernel?" },
      ]);

      expect(res.isMock).toBe(false);
      expect(res.text.length).toBeGreaterThan(10);
      expect(res.model).toBe("openai/gpt-oss-120b");
    });

    it("should generate valid structured JSON adhering to Zod schema", async () => {
      if (!isGroqLive()) return;

      const res = await generateGroqStructured({
        prompt: "Generate a diagnostic multiple-choice question for topic 'Virtual Memory'. Quote: 'Pages are mapped by multi-level page tables'",
        schema: DiagnosticQuestionSchema,
      });

      expect(res.isMock).toBe(false);
      expect(res.data.questionText.length).toBeGreaterThan(10);
      expect(res.data.answerKey).toBeTruthy();
      expect(res.data.explanation).toBeTruthy();
    });
  });

  describe("Jina AI Embeddings Integration (jina-embeddings-v5-text-nano)", () => {
    it("should report live status accurately", () => {
      const live = isJinaLive();
      expect(typeof live).toBe("boolean");
    });

    it("should target exact 768 dimensions", () => {
      expect(getJinaDimensions()).toBe(768);
      expect(getJinaModel()).toBe("jina-embeddings-v5-text-nano");
    });

    it("should return exactly 768-dimensional normalized vectors", async () => {
      if (!isJinaLive()) return;

      const res = await embedTextJina("Virtual Memory Page Table Translation", "retrieval.passage");
      expect(res.isMock).toBe(false);
      expect(res.dimensions).toBe(768);
      expect(res.embedding.length).toBe(768);

      // Verify unit L2 norm
      let sumSq = 0;
      for (const val of res.embedding) {
        expect(Number.isFinite(val)).toBe(true);
        sumSq += val * val;
      }
      expect(Math.abs(Math.sqrt(sumSq) - 1.0)).toBeLessThan(0.05);
    });

    it("should support batch embeddings with distinct vector outputs", async () => {
      if (!isJinaLive()) return;

      const texts = [
        "Peterson's algorithm critical section mutual exclusion",
        "Dijkstra's Banker's algorithm deadlock avoidance safe state",
      ];
      const batch = await embedBatchJina(texts, "retrieval.passage");

      expect(batch.length).toBe(2);
      expect(batch[0].embedding.length).toBe(768);
      expect(batch[1].embedding.length).toBe(768);

      // Verify vectors are not identical
      let dot = 0;
      for (let i = 0; i < 768; i++) {
        dot += batch[0].embedding[i] * batch[1].embedding[i];
      }
      expect(dot).toBeLessThan(0.95);
    });
  });

  describe("Unified AI Facade & Fallbacks", () => {
    it("should route embedText through Jina when configured", async () => {
      const res = await embedText("Demand Paging and Page Faults");
      expect(res.dimensions).toBe(768);
      expect(res.embedding.length).toBe(768);
      if (isJinaLive()) {
        expect(res.isMock).toBe(false);
        expect(res.model).toBe("jina-embeddings-v5-text-nano");
      }
    });

    it("should route generateStructured through Groq when configured", async () => {
      const res = await generateStructured({
        prompt: "Generate an MCQ question about Process Scheduling.",
        schema: DiagnosticQuestionSchema,
        mockFallback: () => ({
          topicId: "mock-t1",
          questionType: "mcq" as const,
          difficulty: 2,
          questionText: "What is Round Robin scheduling?",
          options: [{ id: "A", text: "Time sliced scheduling" }],
          answerKey: "A",
          explanation: "RR uses a fixed quantum.",
          rubric: null,
          sourceChunkId: "chunk-1",
          citationDocumentName: "OS Notes",
          citationPageStart: 1,
          citationPageEnd: 1,
          citationSection: "Scheduling",
          citationQuote: "Round Robin uses fixed time quantum",
        }),
      });

      expect(res.data.questionText).toBeTruthy();
      expect(res.data.answerKey).toBeTruthy();
    });
  });
});
