// ==============================================================================
// GapLens AI — Hybrid Retrieval Engine
// Executes Supabase RPC `match_documents_hybrid` combining vector similarity (pgvector HNSW)
// and keyword search (tsvector GIN) via Reciprocal Rank Fusion (RRF).
// Provides an in-memory RRF fallback for offline demo / test runs with explicit executionMode.
// ==============================================================================

import type { DocumentType, HybridSearchResult, DocumentChunkRow } from "@/types/database";
import type { HybridSearchQuery } from "@/types/rag";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { DEMO_CHUNKS, DEMO_DOCUMENTS } from "@/lib/demo/os-cs301-fixture";

export const DEFAULT_RRF_K = 60;
export const DEFAULT_MATCH_COUNT = 10;

export interface HybridSearchResponse {
  results: HybridSearchResult[];
  executionMode: "supabase_rpc" | "in_memory_fallback";
  isMock: boolean;
  totalFound: number;
}

/**
 * Computes vector cosine similarity between two float vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * Simple keyword BM25-like scoring for in-memory full-text search.
 */
function scoreKeywordRelevance(query: string, content: string): number {
  const queryTerms = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (queryTerms.length === 0) return 0;
  const contentLower = content.toLowerCase();

  let matchScore = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      // Frequency and phrase match bonus
      const occurrences = contentLower.split(term).length - 1;
      matchScore += 1.0 + Math.min(occurrences * 0.2, 1.0);
    }
  }

  return matchScore;
}

export interface InMemorySearchOptions {
  candidateChunks?: DocumentChunkRow[];
  documentMap?:
    | Map<string, { filename: string; doc_type: DocumentType }>
    | Record<string, { filename: string; doc_type: DocumentType }>;
}

/**
 * Performs in-memory Reciprocal Rank Fusion across a candidate chunk pool.
 */
export function inMemoryRRFSearch(
  query: HybridSearchQuery,
  options?: InMemorySearchOptions | DocumentChunkRow[]
): HybridSearchResult[] {
  const candidateChunks = Array.isArray(options)
    ? options
    : options?.candidateChunks ?? DEMO_CHUNKS;

  const matchCount = query.matchCount ?? DEFAULT_MATCH_COUNT;
  const rrfK = query.rrfK ?? DEFAULT_RRF_K;
  const allowedDocTypes = query.allowedDocTypes ?? ["syllabus", "material"];

  // Create doc lookup map
  const docMap = new Map<string, { filename: string; doc_type: DocumentType }>();
  for (const doc of DEMO_DOCUMENTS) {
    docMap.set(doc.id, { filename: doc.filename, doc_type: doc.doc_type });
  }

  // Merge custom documentMap if provided
  if (options && !Array.isArray(options) && options.documentMap) {
    if (options.documentMap instanceof Map) {
      for (const [k, v] of options.documentMap.entries()) {
        docMap.set(k, v);
      }
    } else {
      for (const [k, v] of Object.entries(options.documentMap)) {
        docMap.set(k, v);
      }
    }
  }

  // Filter chunks by workspace and document type if applicable
  const filteredChunks = candidateChunks.filter((chunk) => {
    // If specific workspace is passed and matches
    if (query.workspaceId && chunk.workspace_id !== query.workspaceId) {
      // Allow demo workspace if running against demo data
      if (chunk.workspace_id !== "10000000-0000-0000-0000-000000000001") {
        return false;
      }
    }
    const docMeta = docMap.get(chunk.document_id);
    const chunkDocType: DocumentType =
      (chunk as any).doc_type ?? docMeta?.doc_type ?? "material";

    if (!allowedDocTypes.includes(chunkDocType)) {
      return false;
    }
    return true;
  });

  // 1. Vector scoring and ranking
  const vectorRanked = filteredChunks
    .map((chunk) => ({
      chunk,
      similarity: cosineSimilarity(query.queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  // 2. Keyword/FTS scoring and ranking
  const ftsRanked = filteredChunks
    .map((chunk) => ({
      chunk,
      ftsScore: scoreKeywordRelevance(query.queryText, chunk.content),
    }))
    .filter((item) => item.ftsScore > 0)
    .sort((a, b) => b.ftsScore - a.ftsScore);

  // 3. Reciprocal Rank Fusion combination
  const rrfScores = new Map<string, { chunk: DocumentChunkRow; similarity: number; rrfScore: number }>();

  // Add vector ranks
  vectorRanked.forEach((item, idx) => {
    const rank = idx + 1; // 1-based
    const vScore = 1.0 / (rrfK + rank);
    rrfScores.set(item.chunk.id, {
      chunk: item.chunk,
      similarity: item.similarity,
      rrfScore: vScore,
    });
  });

  // Add FTS ranks
  ftsRanked.forEach((item, idx) => {
    const rank = idx + 1; // 1-based
    const fScore = 1.0 / (rrfK + rank);
    const existing = rrfScores.get(item.chunk.id);
    if (existing) {
      existing.rrfScore += fScore;
    } else {
      rrfScores.set(item.chunk.id, {
        chunk: item.chunk,
        similarity: 0,
        rrfScore: fScore,
      });
    }
  });

  // Sort by combined RRF score descending
  const sortedCandidates = Array.from(rrfScores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, matchCount);

  return sortedCandidates.map((c) => {
    const docMeta = docMap.get(c.chunk.document_id);
    return {
      id: c.chunk.id,
      document_id: c.chunk.document_id,
      chunk_index: c.chunk.chunk_index,
      page_start: c.chunk.page_start,
      page_end: c.chunk.page_end,
      section_heading: c.chunk.section_heading,
      content: c.chunk.content,
      document_name: docMeta?.filename ?? "Operating Systems Lecture Notes.pdf",
      doc_type: docMeta?.doc_type ?? "material",
      similarity: Number(c.similarity.toFixed(4)),
      rrf_score: Number(c.rrfScore.toFixed(6)),
    };
  });
}

/**
 * Main hybrid retrieval function.
 * Attempts Supabase RPC call first when credentials are active;
 * falls back to genuine in-memory RRF calculation with explicit executionMode logging.
 */
export async function hybridSearch(
  query: HybridSearchQuery,
  options?: InMemorySearchOptions | { candidateChunks?: DocumentChunkRow[] }
): Promise<HybridSearchResponse> {
  const matchCount = query.matchCount ?? DEFAULT_MATCH_COUNT;
  const allowedDocTypes = query.allowedDocTypes ?? ["syllabus", "material"];
  const rrfK = query.rrfK ?? DEFAULT_RRF_K;

  if (isSupabaseAdminConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.rpc("match_documents_hybrid", {
        p_workspace_id: query.workspaceId,
        p_query_text: query.queryText,
        p_query_embedding: query.queryEmbedding,
        p_match_count: matchCount,
        p_allowed_doc_types: allowedDocTypes,
        p_rrf_k: rrfK,
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          results: data as HybridSearchResult[],
          executionMode: "supabase_rpc",
          isMock: false,
          totalFound: data.length,
        };
      }
    } catch (rpcErr) {
      console.warn(
        `[Hybrid Retrieval] Supabase RPC failed, using in-memory RRF fallback:`,
        rpcErr instanceof Error ? rpcErr.message : rpcErr
      );
    }
  }

  // In-memory RRF fallback
  const fallbackResults = inMemoryRRFSearch(query, options);
  return {
    results: fallbackResults,
    executionMode: "in_memory_fallback",
    isMock: true,
    totalFound: fallbackResults.length,
  };
}
