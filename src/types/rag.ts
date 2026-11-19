// ==============================================================================
// GapLens AI — RAG and Ingestion Domain Types
// ==============================================================================

import type { DocumentType, DocumentStatus } from "./database";

export interface ExtractedPage {
  pageNumber: number; // 1-based index
  text: string;
  charCount: number;
}

export interface DocumentParseResult {
  filename: string;
  pageCount: number;
  extractedCharCount: number;
  pages: ExtractedPage[];
  needsOcr: boolean;
  ocrReason?: string;
}

export interface ChunkerOptions {
  minTokens?: number; // e.g. 500
  maxTokens?: number; // e.g. 800
  overlapTokens?: number; // e.g. 100
  respectHeadings?: boolean;
}

export interface RawChunk {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  sectionHeading: string | null;
  content: string;
  tokenCount: number;
}

export interface EmbeddedChunk extends RawChunk {
  embedding: number[]; // 768 dimensions
  embeddingModel: string;
}

export interface PinnedCitation {
  chunkId: string;
  documentId: string;
  documentName: string;
  docType: DocumentType;
  pageStart: number;
  pageEnd: number;
  sectionHeading: string | null;
  quote?: string | null;
  isQuoteVerified: boolean;
}

export interface QuoteVerificationResult {
  verified: boolean;
  matchRatio: number;
  normalizedQuote: string;
  normalizedChunkExcerpt?: string;
  rejectionReason?: string;
}

export interface HybridSearchQuery {
  workspaceId: string;
  queryText: string;
  queryEmbedding: number[];
  matchCount?: number;
  allowedDocTypes?: DocumentType[];
  rrfK?: number;
}

export interface IngestionProgressEvent {
  documentId: string;
  status: DocumentStatus;
  progressPercent: number;
  currentStep: string;
  pageCount?: number;
  chunkCount?: number;
  error?: string;
}
