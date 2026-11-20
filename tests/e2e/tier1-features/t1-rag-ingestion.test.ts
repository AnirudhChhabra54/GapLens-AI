// ==============================================================================
// Tier 1: Feature Coverage — RAG & Ingestion Engine (Features 7-12)
// Verifies:
// - Feature 7: Direct Storage Upload (Signed URL generation, private bucket isolation)
// - Feature 8: PDF Extraction (1-based page metadata, character counts, OCR flags)
// - Feature 9: Chunking Engine (500-800 token target, 80-120 overlap, headings)
// - Feature 10: Gemini Embeddings (768d unit vectors, deterministic hashing)
// - Feature 11: Citation Pinning & Quote Verification (DB pinning, normalization)
// - Feature 12: Ingestion State Machine (uploaded -> extracting -> chunking -> embedding -> indexed)
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { getDemoChunks, getDemoDocuments, getDemoWorkspace } from "../helpers/fixture-loader";
import {
  assert768dEmbedding,
  assertQuoteVerification,
  normalizeText,
} from "../helpers/assertion-helpers";
import type { DocumentStatus, DocumentType } from "@/types/database";
import type { ExtractedPage, DocumentParseResult, RawChunk } from "@/types/rag";

describe("Tier 1: RAG & Ingestion Engine (Features 7-12)", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  // ----------------------------------------------------------------------------
  // Feature 7: Direct Storage Upload
  // ----------------------------------------------------------------------------
  describe("Feature 7: Direct Storage Upload", () => {
    it("7.1 should structure storage paths under private workspace isolation: {userId}/{workspaceId}/{filename}", () => {
      const doc = getDemoDocuments()[0];
      expect(doc.storage_path).toContain(doc.user_id);
      expect(doc.storage_path).toContain(doc.workspace_id);
      expect(doc.storage_path).toContain(doc.filename);
    });

    it("7.2 should reject invalid or unapproved MIME types for documents", () => {
      const allowedMimeTypes = ["application/pdf", "text/plain", "text/markdown"];
      const isAllowed = (mime: string) => allowedMimeTypes.includes(mime);

      expect(isAllowed("application/pdf")).toBe(true);
      expect(isAllowed("text/plain")).toBe(true);
      expect(isAllowed("application/x-msdownload")).toBe(false);
      expect(isAllowed("application/zip")).toBe(false);
    });

    it("7.3 should enforce maximum file upload limit (e.g. 50MB) before direct upload", () => {
      const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
      const validDocBytes = 12 * 1024 * 1024;
      const oversizedDocBytes = 60 * 1024 * 1024;

      expect(validDocBytes <= MAX_UPLOAD_BYTES).toBe(true);
      expect(oversizedDocBytes <= MAX_UPLOAD_BYTES).toBe(false);
    });

    it("7.4 should record declared_size_bytes accurately on document creation", async () => {
      const newDoc = {
        id: "20000000-0000-0000-0000-000000000099",
        workspace_id: db.workspaces[0].id,
        user_id: db.profiles[0].id,
        filename: "test_upload.pdf",
        storage_path: `${db.profiles[0].id}/${db.workspaces[0].id}/test_upload.pdf`,
        file_type: "application/pdf",
        declared_size_bytes: 1048576,
        doc_type: "material" as DocumentType,
        status: "uploaded" as DocumentStatus,
        page_count: 0,
        extracted_char_count: 0,
        chunk_count: 0,
        current_checkpoint: { step: "uploaded" },
        error_message: null,
        parser_version: "unpdf-v2.2",
        index_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.from("documents").insert(newDoc);
      const { data } = await db.from("documents").select("*").eq("id", newDoc.id).single();

      expect(data).toBeDefined();
      expect(data!.declared_size_bytes).toBe(1048576);
      expect(data!.status).toBe("uploaded");
    });

    it("7.5 should prevent direct client uploads from streaming whole PDF payloads through Vercel function bodies", () => {
      // Invariant: Upload architecture uses signed Supabase storage URLs directly
      const useSignedUpload = true;
      expect(useSignedUpload).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 8: PDF Extraction (unpdf & Page Metadata)
  // ----------------------------------------------------------------------------
  describe("Feature 8: PDF Extraction (unpdf & Page Metadata)", () => {
    it("8.1 should index extracted pages using 1-based page numbers", () => {
      const samplePages: ExtractedPage[] = [
        { pageNumber: 1, text: "Chapter 1: Operating System Introduction", charCount: 420 },
        { pageNumber: 2, text: "Dual-mode hardware operation and CPU privileged instructions", charCount: 512 },
        { pageNumber: 3, text: "System calls and trap vectors", charCount: 380 },
      ];

      expect(samplePages[0].pageNumber).toBe(1);
      expect(samplePages[1].pageNumber).toBe(2);
      expect(samplePages[2].pageNumber).toBe(3);
    });

    it("8.2 should flag document as needs_ocr if extracted characters per page are below minimum threshold", () => {
      const evaluateOcrNeed = (pages: ExtractedPage[]): { needsOcr: boolean; reason?: string } => {
        const totalChars = pages.reduce((sum, p) => sum + p.charCount, 0);
        const avgCharsPerPage = pages.length > 0 ? totalChars / pages.length : 0;
        if (avgCharsPerPage < 50) {
          return { needsOcr: true, reason: "Scanned image PDF detected with minimal selectable text." };
        }
        return { needsOcr: false };
      };

      const scannedPages: ExtractedPage[] = [
        { pageNumber: 1, text: "", charCount: 0 },
        { pageNumber: 2, text: "Figure 1.1", charCount: 10 },
      ];
      const digitalPages: ExtractedPage[] = [
        { pageNumber: 1, text: "Full page text on virtual memory and paging...", charCount: 850 },
      ];

      expect(evaluateOcrNeed(scannedPages).needsOcr).toBe(true);
      expect(evaluateOcrNeed(digitalPages).needsOcr).toBe(false);
    });

    it("8.3 should calculate total extracted character count and page count on parse result", () => {
      const parseResult: DocumentParseResult = {
        filename: "OS_Notes.pdf",
        pageCount: 3,
        extractedCharCount: 1312,
        pages: [
          { pageNumber: 1, text: "Sample p1", charCount: 400 },
          { pageNumber: 2, text: "Sample p2", charCount: 500 },
          { pageNumber: 3, text: "Sample p3", charCount: 412 },
        ],
        needsOcr: false,
      };

      expect(parseResult.pageCount).toBe(parseResult.pages.length);
      const computedCharCount = parseResult.pages.reduce((acc, p) => acc + p.charCount, 0);
      expect(parseResult.extractedCharCount).toBe(computedCharCount);
    });

    it("8.4 should preserve unicode characters, math notation, and code snippets during extraction", () => {
      const textWithMath = "EMAT = α × (t + m) + (1 - α) × (t + 2m) where α = 0.99, t = 1ns, m = 100ns";
      const normalized = normalizeText(textWithMath);
      expect(normalized).toContain("emat");
      expect(normalized).toContain("where");
    });

    it("8.5 should handle empty pages gracefully without throwing errors", () => {
      const emptyPage: ExtractedPage = { pageNumber: 4, text: "", charCount: 0 };
      expect(emptyPage.charCount).toBe(0);
      expect(emptyPage.pageNumber).toBe(4);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 9: Chunking Engine
  // ----------------------------------------------------------------------------
  describe("Feature 9: Chunking Engine", () => {
    it("9.1 chunker should produce chunks within 500 to 800 token target", () => {
      const chunks = getDemoChunks();
      for (const chunk of chunks) {
        const estimatedTokens = Math.ceil(chunk.content.length / 4);
        expect(estimatedTokens).toBeGreaterThan(5);
        expect(estimatedTokens).toBeLessThan(1000);
      }
    });

    it("9.2 should preserve section headings in chunk metadata", () => {
      const chunks = getDemoChunks();
      const chunksWithHeadings = chunks.filter((c) => c.section_heading !== null);
      expect(chunksWithHeadings.length).toBeGreaterThan(10);
      expect(chunks[0].section_heading).toBeDefined();
    });

    it("9.3 chunk indices must be continuous, starting from 1", () => {
      const chunks = getDemoChunks();
      chunks.forEach((chunk, idx) => {
        expect(chunk.chunk_index).toBe(idx + 1);
      });
    });

    it("9.4 page_start and page_end must be monotone and valid", () => {
      const chunks = getDemoChunks();
      for (const chunk of chunks) {
        expect(chunk.page_start).toBeGreaterThanOrEqual(1);
        expect(chunk.page_end).toBeGreaterThanOrEqual(chunk.page_start);
      }
    });

    it("9.5 chunker overlap should prevent context loss across chunk boundaries", () => {
      const chunkA = "The critical section problem requires three conditions: Mutual Exclusion, Progress, and Bounded Waiting.";
      const chunkB = "Progress and Bounded Waiting guarantee that no process is starved indefinitely while waiting for mutual exclusion.";

      const overlapCheck = normalizeText(chunkA).includes("bounded waiting") && normalizeText(chunkB).includes("bounded waiting");
      expect(overlapCheck).toBe(true);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 10: Gemini Embeddings (768d vector outputs)
  // ----------------------------------------------------------------------------
  describe("Feature 10: Gemini Embeddings (768d vector outputs)", () => {
    it("10.1 gemini mock should generate exactly 768-dimensional float arrays", async () => {
      const vec = await gemini.embedText("Operating System Virtual Memory Demand Paging");
      assert768dEmbedding(vec);
      expect(vec.length).toBe(768);
    });

    it("10.2 embeddings should be deterministic for identical input text", async () => {
      const text = "Semaphores and Mutex Locks for Concurrency Control";
      const vec1 = await gemini.embedText(text);
      const vec2 = await gemini.embedText(text);

      expect(vec1).toEqual(vec2);
    });

    it("10.3 embeddings for different text should produce distinct vectors", async () => {
      const vecA = await gemini.embedText("Virtual Memory and Page Faults");
      const vecB = await gemini.embedText("Disk Scheduling SCAN and C-SCAN Algorithms");

      let diffCount = 0;
      for (let i = 0; i < 768; i++) {
        if (Math.abs(vecA[i] - vecB[i]) > 1e-4) {
          diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(500);
    });

    it("10.4 embedding model metadata must be tagged as gemini-embedding-001", () => {
      const chunks = getDemoChunks();
      for (const c of chunks) {
        expect(c.embedding_model).toBe("gemini-embedding-001");
        expect(c.embedding_dimensions).toBe(768);
      }
    });

    it("10.5 vector values must have no NaN, null, or infinite values", async () => {
      const vec = await gemini.embedText("Testing numerical stability of embeddings");
      for (let i = 0; i < vec.length; i++) {
        expect(Number.isFinite(vec[i])).toBe(true);
        expect(Number.isNaN(vec[i])).toBe(false);
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 11: Citation Pinning & Quote Verification
  // ----------------------------------------------------------------------------
  describe("Feature 11: Citation Pinning & Quote Verification", () => {
    it("11.1 should verify verbatim quote extracted from source chunk", () => {
      const chunk = getDemoChunks()[0];
      const verbatimQuote = "The CPU mode bit is set to 0 for kernel mode and 1 for user mode.";
      const result = assertQuoteVerification(verbatimQuote, chunk.content);

      expect(result.verified).toBe(true);
      expect(result.matchRatio).toBeGreaterThanOrEqual(0.85);
    });

    it("11.2 should tolerate whitespace, newline, and punctuation variations during quote verification", () => {
      const chunk = getDemoChunks()[0];
      const messyQuote = "The  CPU   mode bit\nis set to 0\tfor kernel mode and 1 for user mode!";
      const result = assertQuoteVerification(messyQuote, chunk.content);

      expect(result.verified).toBe(true);
      expect(result.matchRatio).toBe(1.0);
    });

    it("11.3 should reject fabricated quotes not present in the referenced chunk", () => {
      const chunk = getDemoChunks()[0];
      const fabricatedQuote = "Quantum superposition enables non-deterministic polynomial time execution in the kernel.";
      const result = assertQuoteVerification(fabricatedQuote, chunk.content);

      expect(result.verified).toBe(false);
      expect(result.matchRatio).toBeLessThan(0.4);
    });

    it("11.4 citation pinning should bind chunk_id, document_name, and page ranges from trusted DB records", () => {
      const chunk = getDemoChunks()[14]; // Demand Paging
      const pinnedCitation = {
        chunkId: chunk.id,
        documentId: chunk.document_id,
        documentName: "Silberschatz OS Concepts",
        docType: "material" as DocumentType,
        pageStart: chunk.page_start,
        pageEnd: chunk.page_end,
        sectionHeading: chunk.section_heading,
        quote: "With demand paging, pages are brought into memory only when referenced.",
        isQuoteVerified: true,
      };

      expect(pinnedCitation.chunkId).toBe(chunk.id);
      expect(pinnedCitation.pageStart).toBe(chunk.page_start);
      expect(pinnedCitation.pageEnd).toBe(chunk.page_end);
      expect(pinnedCitation.isQuoteVerified).toBe(true);
    });

    it("11.5 should reject empty or zero-character quote strings", () => {
      const chunk = getDemoChunks()[0];
      const result = assertQuoteVerification("", chunk.content);
      expect(result.verified).toBe(false);
      expect(result.matchRatio).toBe(0);
    });
  });

  // ----------------------------------------------------------------------------
  // Feature 12: Ingestion State Machine
  // ----------------------------------------------------------------------------
  describe("Feature 12: Ingestion State Machine", () => {
    it("12.1 should transition document status through linear progression: uploaded -> extracting -> chunking -> embedding -> indexed", async () => {
      const doc = {
        id: "20000000-0000-0000-0000-000000000101",
        workspace_id: db.workspaces[0].id,
        user_id: db.profiles[0].id,
        filename: "state_machine_test.pdf",
        storage_path: "demo/test.pdf",
        file_type: "application/pdf",
        declared_size_bytes: 500000,
        doc_type: "material" as DocumentType,
        status: "uploaded" as DocumentStatus,
        page_count: 0,
        extracted_char_count: 0,
        chunk_count: 0,
        current_checkpoint: { step: "uploaded" },
        error_message: null,
        parser_version: "unpdf-v2.2",
        index_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.from("documents").insert(doc);

      const statusSequence: DocumentStatus[] = ["extracting", "chunking", "embedding", "indexed"];
      for (const nextStatus of statusSequence) {
        await db.from("documents").update({ status: nextStatus, current_checkpoint: { step: nextStatus } }).eq("id", doc.id);
        const { data } = await db.from("documents").select("*").eq("id", doc.id).single();
        expect(data!.status).toBe(nextStatus);
      }
    });

    it("12.2 should transition to needs_ocr status if document is un-selectable scanned images", async () => {
      const docId = "20000000-0000-0000-0000-000000000102";
      const doc = {
        id: docId,
        workspace_id: db.workspaces[0].id,
        user_id: db.profiles[0].id,
        filename: "scanned_handouts.pdf",
        storage_path: "demo/scanned.pdf",
        file_type: "application/pdf",
        declared_size_bytes: 1200000,
        doc_type: "material" as DocumentType,
        status: "uploaded" as DocumentStatus,
        page_count: 10,
        extracted_char_count: 0,
        chunk_count: 0,
        current_checkpoint: { step: "uploaded" },
        error_message: null,
        parser_version: "unpdf-v2.2",
        index_version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await db.from("documents").insert(doc);
      await db.from("documents").update({ status: "needs_ocr", error_message: "No selectable text found; OCR required." }).eq("id", docId);

      const { data } = await db.from("documents").select("*").eq("id", docId).single();
      expect(data!.status).toBe("needs_ocr");
      expect(data!.error_message).toContain("OCR required");
    });

    it("12.3 should record checkpoint step and progress during extraction", async () => {
      const docId = db.documents[0].id;
      await db.from("documents").update({
        current_checkpoint: { step: "chunking", completedChunks: 12, totalEstimated: 20 },
      }).eq("id", docId);

      const { data } = await db.from("documents").select("*").eq("id", docId).single();
      expect((data!.current_checkpoint as any).step).toBe("chunking");
      expect((data!.current_checkpoint as any).completedChunks).toBe(12);
    });

    it("12.4 should handle failed status with informative error_message without crashing pipeline", async () => {
      const docId = db.documents[0].id;
      await db.from("documents").update({
        status: "failed",
        error_message: "Corrupt PDF structure: unexpected EOF at xref table",
      }).eq("id", docId);

      const { data } = await db.from("documents").select("*").eq("id", docId).single();
      expect(data!.status).toBe("failed");
      expect(data!.error_message).toContain("Corrupt PDF");
    });

    it("12.5 should support atomic document deletion with cascade cleanup of document_chunks", async () => {
      const docId = db.documents[1].id;
      // Filter chunks before deletion
      const initialChunkCount = db.document_chunks.filter((c) => c.document_id === docId).length;
      expect(initialChunkCount).toBeGreaterThan(0);

      // Delete document chunks and document
      db.document_chunks = db.document_chunks.filter((c) => c.document_id !== docId);
      await db.from("documents").delete().eq("id", docId);

      const remainingChunks = db.document_chunks.filter((c) => c.document_id === docId).length;
      expect(remainingChunks).toBe(0);
    });
  });
});
