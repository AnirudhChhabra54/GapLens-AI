// ==============================================================================
// GapLens AI — Integration Test: End-to-End RAG & Ingestion Pipeline
// Exercises full workflow:
// Real PDF Binary -> unpdf Parser -> Chunker -> Gemini Embedder -> Hybrid Search (RRF) -> Citation Pinning -> Quote Verification
// ==============================================================================

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parsePdfBuffer } from "@/lib/rag/pdf-parser";
import { chunkExtractedPages } from "@/lib/rag/chunker";
import { embedBatch, TARGET_EMBEDDING_DIMENSIONS, EMBEDDING_MODEL_NAME } from "@/lib/ai/gemini";
import { hybridSearch } from "@/lib/rag/hybrid-retrieval";
import { pinCitation, verifyQuote } from "@/lib/rag/citation-verifier";
import type { DocumentChunkRow } from "@/types/database";

describe("Integration: Full End-to-End RAG & Ingestion Pipeline", () => {
  const samplePdfPath = path.join(process.cwd(), "tests", "fixtures", "sample-os-lecture.pdf");

  it("should execute the complete genuine PDF-to-RAG-to-citation workflow", async () => {
    // --------------------------------------------------------------------------
    // Step 1: Read Real Binary PDF
    // --------------------------------------------------------------------------
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    const pdfBuffer = fs.readFileSync(samplePdfPath);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // --------------------------------------------------------------------------
    // Step 2: Extract text using unpdf parser
    // --------------------------------------------------------------------------
    const parseResult = await parsePdfBuffer(pdfBuffer, { filename: "sample-os-lecture.pdf" });
    expect(parseResult.pageCount).toBe(3);
    expect(parseResult.extractedCharCount).toBeGreaterThan(1500);
    expect(parseResult.needsOcr).toBe(false);
    expect(parseResult.pages).toHaveLength(3);
    expect(parseResult.pages[0].pageNumber).toBe(1);
    expect(parseResult.pages[1].pageNumber).toBe(2);
    expect(parseResult.pages[2].pageNumber).toBe(3);

    // --------------------------------------------------------------------------
    // Step 3: Chunk extracted pages
    // --------------------------------------------------------------------------
    const rawChunks = chunkExtractedPages(parseResult.pages, {
      minTokens: 60,
      maxTokens: 180,
      overlapTokens: 30,
    });
    expect(rawChunks.length).toBeGreaterThanOrEqual(3);
    rawChunks.forEach((c, idx) => {
      expect(c.chunkIndex).toBe(idx + 1);
      expect(c.pageStart).toBeGreaterThanOrEqual(1);
      expect(c.pageEnd).toBeGreaterThanOrEqual(c.pageStart);
      expect(c.tokenCount).toBeGreaterThan(0);
    });

    // --------------------------------------------------------------------------
    // Step 4: Embed chunks using Gemini embedder (768d outputs)
    // --------------------------------------------------------------------------
    const textBatch = rawChunks.map((c) => c.content);
    const embedResults = await embedBatch(textBatch);
    expect(embedResults).toHaveLength(rawChunks.length);

    for (const res of embedResults) {
      expect(res.dimensions).toBe(TARGET_EMBEDDING_DIMENSIONS);
      expect(res.embedding).toHaveLength(TARGET_EMBEDDING_DIMENSIONS);
      expect(res.model).toBe(EMBEDDING_MODEL_NAME);

      // Verify L2 unit normalization
      const norm = Math.sqrt(res.embedding.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 2);
    }

    // --------------------------------------------------------------------------
    // Step 5: Build indexed chunk records for workspace
    // --------------------------------------------------------------------------
    const workspaceId = "10000000-0000-0000-0000-000000000001";
    const documentId = "20000000-0000-0000-0000-000000000001";

    const candidateChunks: DocumentChunkRow[] = rawChunks.map((chunk, i) => ({
      id: `30000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
      document_id: documentId,
      workspace_id: workspaceId,
      user_id: "00000000-0000-0000-0000-000000000001",
      chunk_index: chunk.chunkIndex,
      index_version: 1,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      section_heading: chunk.sectionHeading,
      content: chunk.content,
      embedding: embedResults[i].embedding,
      embedding_model: embedResults[i].model,
      embedding_dimensions: embedResults[i].dimensions,
      created_at: new Date().toISOString(),
    }));

    // --------------------------------------------------------------------------
    // Step 6: Hybrid Retrieval (Querying: Round Robin time quantum)
    // --------------------------------------------------------------------------
    const queryText = "What happens if Round Robin time quantum is extremely small?";
    const queryEmbedResult = await embedBatch([queryText]);
    const queryEmbedding = queryEmbedResult[0].embedding;

    const searchResponse = await hybridSearch(
      {
        workspaceId,
        queryText,
        queryEmbedding,
        matchCount: 3,
        allowedDocTypes: ["material"],
      },
      {
        candidateChunks,
        documentMap: {
          [documentId]: {
            filename: "sample-os-lecture.pdf",
            doc_type: "material",
          },
        },
      }
    );

    expect(searchResponse.results.length).toBeGreaterThan(0);
    const topResult = searchResponse.results[0];

    // Top result should be from Process Scheduling
    expect(topResult.content.toLowerCase()).toContain("round robin");
    expect(topResult.page_start).toBe(1);
    expect(topResult.rrf_score).toBeGreaterThan(0);

    // --------------------------------------------------------------------------
    // Step 7: Citation Pinning to Top Retrieved Chunk
    // --------------------------------------------------------------------------
    const verbatimQuote = "context switch overhead dominates overall CPU utilization";
    const pinnedCitation = pinCitation({
      chunkId: topResult.id,
      candidateChunks,
      quote: verbatimQuote,
      fallbackDocumentName: "sample-os-lecture.pdf",
      fallbackDocType: "material",
    });

    expect(pinnedCitation.chunkId).toBe(topResult.id);
    expect(pinnedCitation.documentId).toBe(documentId);
    expect(pinnedCitation.documentName).toBe("sample-os-lecture.pdf");
    expect(pinnedCitation.pageStart).toBe(1);
    expect(pinnedCitation.quote).toBe(verbatimQuote);
    expect(pinnedCitation.isQuoteVerified).toBe(true);

    // --------------------------------------------------------------------------
    // Step 8: Verbatim Quote Verification & Hallucination Rejection
    // --------------------------------------------------------------------------
    const verifiedResult = verifyQuote(verbatimQuote, topResult.content);
    expect(verifiedResult.verified).toBe(true);
    expect(verifiedResult.matchRatio).toBe(1.0);

    const fabricatedQuote = "Hyper-threading utilizes quantum entangled qubits to bypass paging.";
    const rejectedResult = verifyQuote(fabricatedQuote, topResult.content);
    expect(rejectedResult.verified).toBe(false);
    expect(rejectedResult.matchRatio).toBeLessThan(0.4);
    expect(rejectedResult.rejectionReason).toBeDefined();

    // --------------------------------------------------------------------------
    // Step 9: Anti-Hallucination Chunk Boundary Enforcement
    // --------------------------------------------------------------------------
    const nonExistentChunkId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    expect(() => {
      pinCitation({
        chunkId: nonExistentChunkId,
        candidateChunks,
        quote: verbatimQuote,
      });
    }).toThrowError(/Citation pinning rejected: referenced chunk ID/);
  });
});
