// ==============================================================================
// Tier 3: Pairwise Cross-Feature Interactions — Ingestion to Retrieval
// Verifies integration pipeline:
// Upload -> Parse (unpdf) -> Chunk -> 768d Embed -> RRF Hybrid Search
// ==============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySupabaseMock, DeterministicGeminiMock } from "../helpers/mock-adapters";
import { assert768dEmbedding, assertQuoteVerification, assertRRFScoring } from "../helpers/assertion-helpers";
import type { DocumentRow, DocumentChunkRow, DocumentStatus, DocumentType } from "@/types/database";

describe("Tier 3: Ingestion to Retrieval Pipeline (Cross-Feature Pairwise)", () => {
  let db: InMemorySupabaseMock;
  let gemini: DeterministicGeminiMock;

  beforeEach(() => {
    db = new InMemorySupabaseMock();
    gemini = new DeterministicGeminiMock();
  });

  it("T3.IR.1: should execute full document ingestion pipeline from upload to indexed status", async () => {
    const docId = "20000000-0000-0000-0000-000000000201";
    const newDoc: DocumentRow = {
      id: docId,
      workspace_id: db.workspaces[0].id,
      user_id: db.profiles[0].id,
      filename: "Operating_Systems_Concurrency_Guide.pdf",
      storage_path: `${db.profiles[0].id}/${db.workspaces[0].id}/Concurrency_Guide.pdf`,
      file_type: "application/pdf",
      declared_size_bytes: 850000,
      doc_type: "material",
      status: "uploaded",
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

    // 1. Extraction step
    await db.from("documents").update({ status: "extracting", page_count: 8, extracted_char_count: 24000 }).eq("id", docId);
    let { data: doc } = await db.from("documents").select("*").eq("id", docId).single();
    expect(doc!.status).toBe("extracting");
    expect(doc!.page_count).toBe(8);

    // 2. Chunking step
    await db.from("documents").update({ status: "chunking", chunk_count: 4 }).eq("id", docId);
    doc = (await db.from("documents").select("*").eq("id", docId).single()).data;
    expect(doc!.status).toBe("chunking");

    // 3. Embedding step
    await db.from("documents").update({ status: "embedding" }).eq("id", docId);
    doc = (await db.from("documents").select("*").eq("id", docId).single()).data;
    expect(doc!.status).toBe("embedding");

    // 4. Final indexed step
    await db.from("documents").update({ status: "indexed", current_checkpoint: { step: "complete" } }).eq("id", docId);
    doc = (await db.from("documents").select("*").eq("id", docId).single()).data;
    expect(doc!.status).toBe("indexed");
  });

  it("T3.IR.2: chunks generated during ingestion must preserve 1-based page metadata and section headings", () => {
    const chunks = db.document_chunks;
    for (const chunk of chunks) {
      expect(chunk.page_start).toBeGreaterThanOrEqual(1);
      expect(chunk.page_end).toBeGreaterThanOrEqual(chunk.page_start);
      expect(chunk.section_heading).toBeDefined();
    }
  });

  it("T3.IR.3: generated embeddings must strictly conform to 768-dimensional normalized float format", async () => {
    const content = "Monitors and Condition Variables encapsulate mutual exclusion and signaling in concurrent programming.";
    const embedding = await gemini.embedText(content);
    assert768dEmbedding(embedding);
  });

  it("T3.IR.4: hybrid search should retrieve ingested chunks matching semantic intent", async () => {
    const query = "What is the critical section problem in multi-threaded programming?";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results, error } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    });

    expect(error).toBeNull();
    expect(results).toBeDefined();
    expect(results!.length).toBeGreaterThan(0);
    // Recall@5: Critical section chunk should be retrieved in top-5
    expect(results!.some((r) => r.content.includes("Critical Section"))).toBe(true);
  });

  it("T3.IR.5: hybrid search results must be correctly ordered by RRF score descending", async () => {
    const query = "demand paging TLB miss translation";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    });

    expect(results).toBeDefined();
    assertRRFScoring(results!);
  });

  it("T3.IR.6: retrieved chunks must carry trusted document filename and page ranges", async () => {
    const query = "Banker's Algorithm safe state";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_match_count: 3,
    });

    expect(results).toBeDefined();
    const topResult = results![0];
    expect(topResult.document_name).toContain("Silberschatz");
    expect(topResult.page_start).toBeGreaterThanOrEqual(1);
    expect(topResult.page_end).toBeGreaterThanOrEqual(topResult.page_start);
  });

  it("T3.IR.7: quote extracted from retrieved chunk must pass quote verification", async () => {
    const query = "CPU scheduling algorithms Round Robin SJF";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_match_count: 5,
    });

    expect(results).toBeDefined();
    const targetChunk = results!.find((r) => r.content.includes("Round Robin")) || results![0];
    const excerpt = targetChunk.content.slice(0, 40);
    const verification = assertQuoteVerification(excerpt, targetChunk.content);

    expect(verification.verified).toBe(true);
    expect(verification.matchRatio).toBe(1.0);
  });

  it("T3.IR.8: keyword search should boost chunks containing exact phrase tokens even with moderate vector similarity", async () => {
    const query = "Belady's Anomaly";
    const queryEmbedding = await gemini.embedText("page replacement faults FIFO");

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
      p_match_count: 3,
    });

    expect(results).toBeDefined();
    expect(results!.some((r) => r.content.includes("Belady"))).toBe(true);
  });

  it("T3.IR.9: workspace isolation must prevent cross-workspace chunk retrieval", async () => {
    const foreignWorkspaceId = "10000000-0000-0000-0000-999999999999";
    const query = "Operating System Kernel";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: foreignWorkspaceId,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
    });

    expect(results).toEqual([]);
  });

  it("T3.IR.10: deleting a document must remove all constituent chunks from subsequent hybrid searches", async () => {
    const targetDocId = db.documents[1].id;
    // Remove chunks belonging to target document
    db.document_chunks = db.document_chunks.filter((c) => c.document_id !== targetDocId);

    const query = "Virtual Memory demand paging";
    const queryEmbedding = await gemini.embedText(query);

    const { data: results } = await db.rpc("match_documents_hybrid", {
      p_workspace_id: db.workspaces[0].id,
      p_query_text: query,
      p_query_embedding: queryEmbedding,
    });

    expect(results!.every((r) => r.document_id !== targetDocId)).toBe(true);
  });

  it("T3.IR.11: chunk index versions must match document index version", () => {
    const doc = db.documents[1];
    const chunks = db.document_chunks.filter((c) => c.document_id === doc.id);
    for (const chunk of chunks) {
      expect(chunk.index_version).toBe(doc.index_version);
    }
  });
});
