// ==============================================================================
// GapLens AI — Citation Pinning & Verbatim Quote Verification Engine
// Protects against LLM hallucination by strictly binding model citations to trusted DB metadata
// and validating quotes with whitespace/punctuation-tolerant normalization.
// ==============================================================================

import type { DocumentType, DocumentChunkRow, HybridSearchResult } from "@/types/database";
import type { PinnedCitation, QuoteVerificationResult } from "@/types/rag";

export const DEFAULT_QUOTE_VERIFY_THRESHOLD = 0.85;

/**
 * Normalizes text for quote matching:
 * lowercases, converts newlines/tabs to spaces, strips non-alphanumeric punctuation, collapses spaces.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[-/]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifies whether a cited quote genuinely exists in the referenced chunk text.
 * Tolerates formatting, newline, punctuation, and minor whitespace variations.
 */
export function verifyQuote(
  quote: string | null | undefined,
  chunkContent: string,
  minThreshold = DEFAULT_QUOTE_VERIFY_THRESHOLD
): QuoteVerificationResult {
  if (!quote || quote.trim().length === 0) {
    return {
      verified: false,
      matchRatio: 0,
      normalizedQuote: "",
      rejectionReason: "Quote is empty or contains only whitespace.",
    };
  }

  const normQuote = normalizeText(quote);
  const normChunk = normalizeText(chunkContent);

  if (normQuote.length === 0) {
    return {
      verified: false,
      matchRatio: 0,
      normalizedQuote: "",
      rejectionReason: "Quote contains no valid alphanumeric tokens after normalization.",
    };
  }

  // Exact normalized substring match
  if (normChunk.includes(normQuote)) {
    return {
      verified: true,
      matchRatio: 1.0,
      normalizedQuote: normQuote,
      normalizedChunkExcerpt: normQuote,
    };
  }

  // Token-level overlap verification
  const quoteTokens = normQuote.split(" ").filter((t) => t.length > 0);
  const chunkTokenSet = new Set(normChunk.split(" ").filter((t) => t.length > 0));

  let matchedTokens = 0;
  for (const token of quoteTokens) {
    if (chunkTokenSet.has(token)) {
      matchedTokens++;
    }
  }

  const matchRatio = quoteTokens.length > 0 ? matchedTokens / quoteTokens.length : 0;
  const verified = matchRatio >= minThreshold;

  return {
    verified,
    matchRatio: Number(matchRatio.toFixed(4)),
    normalizedQuote: normQuote,
    rejectionReason: verified
      ? undefined
      : `Quote match ratio (${(matchRatio * 100).toFixed(1)}%) is below required threshold (${(minThreshold * 100).toFixed(1)}%). Excerpt not found in source chunk.`,
  };
}

export interface PinCitationParams {
  chunkId: string;
  candidateChunks: Array<DocumentChunkRow | HybridSearchResult>;
  quote?: string | null;
  fallbackDocumentName?: string;
  fallbackDocType?: DocumentType;
}

/**
 * Attaches verified DB metadata to a model citation.
 * Rejects any citation referencing an unknown chunk ID not present in candidateChunks.
 */
export function pinCitation(params: PinCitationParams): PinnedCitation {
  const { chunkId, candidateChunks, quote, fallbackDocumentName, fallbackDocType } = params;

  const foundChunk = candidateChunks.find((c) => c.id === chunkId);
  if (!foundChunk) {
    throw new Error(
      `Citation pinning rejected: referenced chunk ID '${chunkId}' is not in the authorized candidate chunk set. Possible model hallucination.`
    );
  }

  // Check quote verification if quote provided
  let isQuoteVerified = true;
  if (quote && quote.trim().length > 0) {
    const verification = verifyQuote(quote, foundChunk.content);
    isQuoteVerified = verification.verified;
  }

  const documentName =
    "document_name" in foundChunk && typeof foundChunk.document_name === "string"
      ? foundChunk.document_name
      : fallbackDocumentName ?? "Source Document";

  const docType =
    "doc_type" in foundChunk && typeof foundChunk.doc_type === "string"
      ? (foundChunk.doc_type as DocumentType)
      : fallbackDocType ?? "material";

  return {
    chunkId: foundChunk.id,
    documentId: foundChunk.document_id,
    documentName,
    docType,
    pageStart: foundChunk.page_start,
    pageEnd: foundChunk.page_end,
    sectionHeading: foundChunk.section_heading,
    quote: quote ?? null,
    isQuoteVerified,
  };
}
