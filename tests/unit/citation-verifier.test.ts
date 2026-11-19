// ==============================================================================
// GapLens AI — Unit Tests: Citation Pinning & Quote Verifier
// ==============================================================================

import { describe, it, expect } from "vitest";
import { verifyQuote, pinCitation, normalizeText } from "@/lib/rag/citation-verifier";
import type { DocumentChunkRow } from "@/types/database";

describe("Unit: Citation Pinning & Quote Verifier", () => {
  const sampleChunk: DocumentChunkRow = {
    id: "30000000-0000-0000-0000-000000000001",
    document_id: "20000000-0000-0000-0000-000000000001",
    workspace_id: "10000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000001",
    chunk_index: 1,
    index_version: 1,
    page_start: 1,
    page_end: 1,
    section_heading: "Chapter 1: Operating System Architectures",
    content:
      "Dual-mode operation allows OS to protect itself and other system components. User mode and kernel mode are distinguished by a hardware mode bit: 0 for kernel mode and 1 for user mode.",
    embedding: new Array(768).fill(0.01),
    embedding_model: "gemini-embedding-001",
    embedding_dimensions: 768,
    created_at: new Date().toISOString(),
  };

  it("should normalize text by stripping punctuation, newlines, and collapsing spaces", () => {
    const raw = "Dual-mode operation,\n\tallows the OS  to protect itself!";
    const normalized = normalizeText(raw);
    expect(normalized).toBe("dual mode operation allows the os to protect itself");
  });

  it("should normalize hyphens and slashes with spaces to match compound technical terms", () => {
    const chunkContent =
      "The translation look aside buffer uses multi level feedback queues for high performance non volatile memory management";
    const hyphenatedQuote =
      "The translation look-aside buffer uses multi-level feedback queues for high-performance non-volatile memory management";
    const result = verifyQuote(hyphenatedQuote, chunkContent);

    expect(result.verified).toBe(true);
    expect(result.matchRatio).toBe(1.0);
  });

  it("should verify exact verbatim quotes within source chunk", () => {
    const quote = "User mode and kernel mode are distinguished by a hardware mode bit";
    const result = verifyQuote(quote, sampleChunk.content);

    expect(result.verified).toBe(true);
    expect(result.matchRatio).toBe(1.0);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should tolerate whitespace, newlines, and punctuation variations in quote verification", () => {
    const messyQuote =
      "User mode  and\nkernel mode are distinguished\tby a hardware mode bit: 0 for kernel mode!";
    const result = verifyQuote(messyQuote, sampleChunk.content);

    expect(result.verified).toBe(true);
    expect(result.matchRatio).toBeGreaterThanOrEqual(0.85);
  });

  it("should reject fabricated or hallucinated quotes not present in the chunk", () => {
    const hallucinatedQuote =
      "Quantum neural networks accelerate process scheduling via Hilbert space transformations.";
    const result = verifyQuote(hallucinatedQuote, sampleChunk.content);

    expect(result.verified).toBe(false);
    expect(result.matchRatio).toBeLessThan(0.4);
    expect(result.rejectionReason).toBeDefined();
    expect(result.rejectionReason).toContain("is below required threshold");
  });

  it("should reject empty or whitespace-only quotes", () => {
    const emptyResult = verifyQuote("   \t\n   ", sampleChunk.content);
    expect(emptyResult.verified).toBe(false);
    expect(emptyResult.matchRatio).toBe(0);
    expect(emptyResult.rejectionReason).toContain("Quote is empty");
  });

  it("should pin citation by attaching verified document metadata from database chunk", () => {
    const pinned = pinCitation({
      chunkId: sampleChunk.id,
      candidateChunks: [sampleChunk],
      quote: "User mode and kernel mode are distinguished by a hardware mode bit",
      fallbackDocumentName: "CS301 Lecture Notes.pdf",
      fallbackDocType: "material",
    });

    expect(pinned.chunkId).toBe(sampleChunk.id);
    expect(pinned.documentId).toBe(sampleChunk.document_id);
    expect(pinned.documentName).toBe("CS301 Lecture Notes.pdf");
    expect(pinned.docType).toBe("material");
    expect(pinned.pageStart).toBe(1);
    expect(pinned.pageEnd).toBe(1);
    expect(pinned.sectionHeading).toBe("Chapter 1: Operating System Architectures");
    expect(pinned.isQuoteVerified).toBe(true);
  });

  it("should throw an anti-hallucination error when given an unknown chunkId not in candidate set", () => {
    expect(() => {
      pinCitation({
        chunkId: "99999999-9999-9999-9999-999999999999",
        candidateChunks: [sampleChunk],
        quote: "Some quote",
      });
    }).toThrowError(/Citation pinning rejected: referenced chunk ID/);
  });
});
