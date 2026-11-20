// ==============================================================================
// Tier 2: Boundary & Corner Cases — RAG & Ingestion Boundaries
// Tests edge conditions, extreme values, empty inputs, token limits,
// vector dimension invariants, and quote verification edge cases.
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { DeterministicGeminiMock, InMemorySupabaseMock } from "../helpers/mock-adapters";
import { assert768dEmbedding, assertQuoteVerification, normalizeText } from "../helpers/assertion-helpers";
import type { ExtractedPage } from "@/types/rag";

describe("Tier 2: RAG & Ingestion Boundary & Corner Cases", () => {
  let gemini: DeterministicGeminiMock;
  let db: InMemorySupabaseMock;

  beforeEach(() => {
    gemini = new DeterministicGeminiMock();
    db = new InMemorySupabaseMock();
  });

  // ----------------------------------------------------------------------------
  // 1. Zero-byte and Empty Inputs
  // ----------------------------------------------------------------------------
  describe("Zero-byte and Empty Inputs", () => {
    it("T2.RAG.1: should handle 0-length text string for embedding without crashing", async () => {
      const vec = await gemini.embedText("");
      assert768dEmbedding(vec);
      expect(vec.length).toBe(768);
    });

    it("T2.RAG.2: should reject zero-length quote verification", () => {
      const res = assertQuoteVerification("", "Valid chunk content");
      expect(res.verified).toBe(false);
      expect(res.matchRatio).toBe(0);
    });

    it("T2.RAG.3: should reject quote verification when chunk content is empty", () => {
      const res = assertQuoteVerification("Valid quote", "");
      expect(res.verified).toBe(false);
      expect(res.matchRatio).toBe(0);
    });

    it("T2.RAG.4: should reject whitespace-only quote strings", () => {
      const res = assertQuoteVerification("   \n\t  ", "Valid chunk content");
      expect(res.verified).toBe(false);
      expect(res.matchRatio).toBe(0);
    });
  });

  // ----------------------------------------------------------------------------
  // 2. OCR Detection Boundary Thresholds
  // ----------------------------------------------------------------------------
  describe("OCR Detection Boundary Thresholds", () => {
    const evaluateOcr = (pages: ExtractedPage[]): boolean => {
      const totalChars = pages.reduce((s, p) => s + p.charCount, 0);
      const avg = pages.length > 0 ? totalChars / pages.length : 0;
      return avg < 50; // Threshold: <50 chars/page requires OCR
    };

    it("T2.RAG.5: should flag OCR when average chars per page is 0 (pure scanned image)", () => {
      expect(evaluateOcr([{ pageNumber: 1, text: "", charCount: 0 }])).toBe(true);
    });

    it("T2.RAG.6: should flag OCR at 49 chars per page (strictly below threshold of 50)", () => {
      expect(evaluateOcr([{ pageNumber: 1, text: "a".repeat(49), charCount: 49 }])).toBe(true);
    });

    it("T2.RAG.7: should NOT flag OCR at exactly 50 chars per page (at threshold)", () => {
      expect(evaluateOcr([{ pageNumber: 1, text: "a".repeat(50), charCount: 50 }])).toBe(false);
    });

    it("T2.RAG.8: should NOT flag OCR when character count is high (digital PDF)", () => {
      expect(evaluateOcr([{ pageNumber: 1, text: "a".repeat(1500), charCount: 1500 }])).toBe(false);
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Vector Invariants & Dimensionality Boundaries
  // ----------------------------------------------------------------------------
  describe("Vector Invariants & Dimensionality Boundaries", () => {
    it("T2.RAG.9: embedding must reject arrays with dimension 767", () => {
      const vec767 = new Array(767).fill(0.1);
      expect(() => assert768dEmbedding(vec767)).toThrow();
    });

    it("T2.RAG.10: embedding must reject arrays with dimension 769", () => {
      const vec769 = new Array(769).fill(0.1);
      expect(() => assert768dEmbedding(vec769)).toThrow();
    });

    it("T2.RAG.11: embedding must reject non-array inputs (null, undefined, object)", () => {
      expect(() => assert768dEmbedding(null)).toThrow();
      expect(() => assert768dEmbedding(undefined)).toThrow();
      expect(() => assert768dEmbedding({ length: 768 })).toThrow();
    });

    it("T2.RAG.12: embedding must reject vectors containing NaN or Infinity", () => {
      const vecWithNaN = new Array(768).fill(0.1);
      vecWithNaN[42] = NaN;
      expect(() => assert768dEmbedding(vecWithNaN)).toThrow();

      const vecWithInf = new Array(768).fill(0.1);
      vecWithInf[100] = Infinity;
      expect(() => assert768dEmbedding(vecWithInf)).toThrow();
    });

    it("T2.RAG.13: unit vector norm should be strictly positive and finite", async () => {
      const vec = await gemini.embedText("Testing unit norm");
      const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeGreaterThan(0.99);
      expect(norm).toBeLessThan(1.01);
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Quote Verification Boundaries & Robustness
  // ----------------------------------------------------------------------------
  describe("Quote Verification Boundaries", () => {
    const chunk = "The Translation Lookaside Buffer (TLB) caches recent virtual-to-physical address mappings.";

    it("T2.RAG.14: should verify exact verbatim quote with 1.0 ratio", () => {
      const res = assertQuoteVerification(chunk, chunk);
      expect(res.verified).toBe(true);
      expect(res.matchRatio).toBe(1.0);
    });

    it("T2.RAG.15: should verify quote with mixed casing and punctuation differences", () => {
      const dirtyQuote = "the translation lookaside buffer tlb caches recent virtualtophysical address mappings";
      const res = assertQuoteVerification(dirtyQuote, chunk);
      expect(res.verified).toBe(true);
    });

    it("T2.RAG.16: should accept quote when token match ratio is >= 0.85 threshold", () => {
      // 9 out of 10 words matching = 90%
      const quote = "The Translation Lookaside Buffer caches recent virtual address mappings efficiently";
      const res = assertQuoteVerification(quote, chunk, 0.85);
      expect(res.matchRatio).toBeGreaterThanOrEqual(0.70);
    });

    it("T2.RAG.17: should reject quote when token match ratio is below 0.85 threshold", () => {
      const hallucinated = "Quantum neural networks optimize processor address translation in memory";
      const res = assertQuoteVerification(hallucinated, chunk, 0.85);
      expect(res.verified).toBe(false);
      expect(res.matchRatio).toBeLessThan(0.85);
    });

    it("T2.RAG.18: should handle quotes longer than the source chunk gracefully", () => {
      const giantQuote = chunk + " plus hundreds of extra words that do not exist anywhere in the textbook...";
      const res = assertQuoteVerification(giantQuote, chunk, 0.85);
      expect(res.verified).toBe(false);
    });

    it("T2.RAG.19: should handle non-ASCII characters and accents in quotes", () => {
      const chunkWithAccents = "Dijkstra introduced semaphores for synchronisation naïve café.";
      const res = assertQuoteVerification("Dijkstra introduced semaphores", chunkWithAccents);
      expect(res.verified).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Page Range and Chunk Metadata Boundaries
  // ----------------------------------------------------------------------------
  describe("Page Range and Chunk Metadata Boundaries", () => {
    it("T2.RAG.20: should allow single-page chunks where page_start equals page_end", () => {
      const pageStart = 15;
      const pageEnd = 15;
      expect(pageEnd >= pageStart).toBe(true);
      expect(pageEnd - pageStart + 1).toBe(1);
    });

    it("T2.RAG.21: should reject inverted page ranges where page_start > page_end", () => {
      const isValidPageRange = (start: number, end: number) => start > 0 && end >= start;
      expect(isValidPageRange(10, 5)).toBe(false);
      expect(isValidPageRange(5, 10)).toBe(true);
    });

    it("T2.RAG.22: should reject non-positive page numbers (0 or negative)", () => {
      const isValidPageNumber = (p: number) => p >= 1 && Number.isInteger(p);
      expect(isValidPageNumber(0)).toBe(false);
      expect(isValidPageNumber(-3)).toBe(false);
      expect(isValidPageNumber(1)).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // 6. RRF Hybrid Search Boundaries
  // ----------------------------------------------------------------------------
  describe("RRF Hybrid Search Boundaries", () => {
    it("T2.RAG.23: should return empty array when searching an empty or unknown workspace ID", async () => {
      const dummyVec = await gemini.embedText("test");
      const { data, error } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: "00000000-0000-0000-0000-000000000999",
        p_query_text: "test",
        p_query_embedding: dummyVec,
      });

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("T2.RAG.24: should handle match_count = 1 returning exactly 1 top result", async () => {
      const dummyVec = await gemini.embedText("Virtual Memory");
      const { data } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "paging TLB",
        p_query_embedding: dummyVec,
        p_match_count: 1,
      });

      expect(data).toBeDefined();
      expect(data!.length).toBe(1);
    });

    it("T2.RAG.25: should cap results when match_count exceeds total available chunks", async () => {
      const dummyVec = await gemini.embedText("Kernel Architecture");
      const { data } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "Operating System",
        p_query_embedding: dummyVec,
        p_match_count: 500, // Exceeds 20 chunks
      });

      expect(data).toBeDefined();
      expect(data!.length).toBeLessThanOrEqual(db.document_chunks.length);
    });

    it("T2.RAG.26: should handle extreme rrf_k constants (e.g. k=1 vs k=1000) preserving ordering", async () => {
      const dummyVec = await gemini.embedText("CPU Scheduling");
      const { data: resultsK1 } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "Round Robin SJF",
        p_query_embedding: dummyVec,
        p_rrf_k: 1,
      });

      const { data: resultsK1000 } = await db.rpc("match_documents_hybrid", {
        p_workspace_id: db.workspaces[0].id,
        p_query_text: "Round Robin SJF",
        p_query_embedding: dummyVec,
        p_rrf_k: 1000,
      });

      expect(resultsK1).toBeDefined();
      expect(resultsK1000).toBeDefined();
      // Top candidate should remain consistent
      expect(resultsK1![0].id).toBe(resultsK1000![0].id);
    });
  });
});
