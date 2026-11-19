// ==============================================================================
// GapLens AI — Token-Aware Document Chunker
// Respects headings (#, ##, Chapter X), paragraph boundaries, and page spans
// Targets 500-800 tokens with 80-120 token overlap to avoid context loss
// ==============================================================================

import type { ChunkerOptions, ExtractedPage, RawChunk } from "@/types/rag";

export const DEFAULT_MIN_TOKENS = 500;
export const DEFAULT_MAX_TOKENS = 800;
export const DEFAULT_OVERLAP_TOKENS = 100;

/**
 * Estimates token count from text using character and word heuristics (~4 chars/token).
 */
export function estimateTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  // Blended heuristic: chars / 4 and words * 1.3
  const charBased = Math.ceil(text.length / 4);
  const wordBased = Math.ceil(text.trim().split(/\s+/).length * 1.3);
  return Math.max(1, Math.round((charBased + wordBased) / 2));
}

interface TextBlock {
  text: string;
  pageNumber: number;
  heading: string | null;
  tokenCount: number;
}

/**
 * Detects if a line looks like a markdown, numbered, or uppercase section heading.
 */
export function extractHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Markdown heading (# Heading, ## Heading, ### Heading, #### Heading)
  const mdMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
  if (mdMatch) {
    const title = mdMatch[1].trim().replace(/\s+#+$/, "");
    return title || null;
  }

  // Headings are titles: they must be reasonably concise (<= 80 chars)
  if (trimmed.length > 80) {
    return null;
  }

  // If a line ends with terminal punctuation (. ! ?), it is almost certainly a body sentence or list item, not a section title.
  if (/[.!?]$/.test(trimmed)) {
    return null;
  }

  // 2. Standalone all-caps title (short line 4-60 chars)
  if (
    trimmed.length >= 4 &&
    trimmed.length <= 60 &&
    trimmed === trimmed.toUpperCase() &&
    /^[A-Z0-9\s:,-]+$/.test(trimmed) &&
    /[A-Z]/.test(trimmed)
  ) {
    return trimmed;
  }

  // 3. Labelled chapter/section heading: "Chapter 1: Title", "Section 2 - Title", "Module A", "Unit 3"
  const labelMatch = trimmed.match(/^(?:Chapter|Section|Module|Unit|Part)\s*(?:\d+|[A-ZIVX]+)?(?:\s*[:.-]\s*(.+))?$/i);
  if (labelMatch) {
    return trimmed;
  }

  // 4. Hierarchical numbered headings: "1.1 Title", "1.2.3 Title", "2.0 Architecture"
  const hierarchicalMatch = trimmed.match(/^\d+\.\d+(?:\.\d+)*\s*[:.-]?\s*([A-Z].*)$/);
  if (hierarchicalMatch) {
    return trimmed;
  }

  return null;
}

/**
 * Splits unpunctuated or oversized text into word-bounded slices respecting token limits.
 */
function splitTextByWords(text: string, targetTokens: number, maxTokens: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0 || (words.length === 1 && words[0] === "")) return [];

  const slices: string[] = [];
  let currentWords: string[] = [];

  for (const word of words) {
    currentWords.push(word);
    const candidate = currentWords.join(" ");
    const candTokens = estimateTokens(candidate);

    if (candTokens >= targetTokens) {
      if (currentWords.length > 1) {
        currentWords.pop();
        slices.push(currentWords.join(" "));
        currentWords = [word];
      } else {
        // Even a single word exceeds targetTokens (e.g. extremely long token or minified string)
        const charLimit = Math.max(20, maxTokens * 4);
        let remaining = word;
        while (remaining.length > charLimit) {
          slices.push(remaining.substring(0, charLimit));
          remaining = remaining.substring(charLimit);
        }
        if (remaining.length > 0) {
          currentWords = [remaining];
        } else {
          currentWords = [];
        }
      }
    }
  }

  if (currentWords.length > 0) {
    slices.push(currentWords.join(" "));
  }

  return slices;
}

/**
 * Splits an oversized block into smaller pieces respecting token limits.
 * Tries sentence boundaries first, falling back to word/token slicing if unpunctuated.
 */
function splitOversizedBlock(text: string, maxTokens: number): string[] {
  const targetSliceTokens = Math.max(40, Math.floor(maxTokens * 0.65));

  // Try splitting by sentence boundaries (. ! ?)
  const sentenceMatches = text.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g);

  // If no sentences or only 1 huge sentence, slice by words
  if (!sentenceMatches || sentenceMatches.length <= 1) {
    return splitTextByWords(text, targetSliceTokens, maxTokens);
  }

  // If there are multiple sentences, verify each sentence is within limits
  const segments: string[] = [];
  for (const sent of sentenceMatches) {
    const trimmed = sent.trim();
    if (!trimmed) continue;
    if (estimateTokens(trimmed) > maxTokens) {
      segments.push(...splitTextByWords(trimmed, targetSliceTokens, maxTokens));
    } else {
      segments.push(trimmed);
    }
  }

  return segments;
}

/**
 * Splits extracted pages into structured text blocks tagged with page and active heading.
 */
function extractBlocksFromPages(pages: ExtractedPage[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  let currentHeading: string | null = null;

  for (const page of pages) {
    if (!page.text || page.text.trim().length === 0) continue;

    // Split page content into paragraphs by double newlines or single newline if isolated
    const rawParagraphs = page.text.split(/\n\s*\n+/);

    for (const para of rawParagraphs) {
      const cleanPara = para.trim();
      if (!cleanPara) continue;

      // Check if paragraph starts with or is a heading
      const firstLine = cleanPara.split("\n")[0].trim();
      const detectedHeading = extractHeading(firstLine);

      if (detectedHeading) {
        currentHeading = detectedHeading;
        // Never discard the paragraph even if it is a standalone heading line (# Chapter 1, Section 2, etc.)
        blocks.push({
          text: cleanPara,
          pageNumber: page.pageNumber,
          heading: currentHeading,
          tokenCount: estimateTokens(cleanPara),
        });
      } else {
        blocks.push({
          text: cleanPara,
          pageNumber: page.pageNumber,
          heading: currentHeading,
          tokenCount: estimateTokens(cleanPara),
        });
      }
    }
  }

  return blocks;
}

/**
 * Splits extracted document pages into token-bounded, overlapping RawChunks.
 */
export function chunkExtractedPages(
  pages: ExtractedPage[],
  options: ChunkerOptions = {}
): RawChunk[] {
  const minTokens = options.minTokens ?? DEFAULT_MIN_TOKENS;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const blocks = extractBlocksFromPages(pages);
  if (blocks.length === 0) {
    return [];
  }

  const rawChunks: RawChunk[] = [];
  let currentChunkBlocks: TextBlock[] = [];
  let currentTokens = 0;
  let chunkIndex = 1;
  let hasNewContentInChunk = false;

  function finalizeCurrentChunk() {
    if (currentChunkBlocks.length === 0) return;

    const pageStart = currentChunkBlocks[0].pageNumber;
    const pageEnd = currentChunkBlocks[currentChunkBlocks.length - 1].pageNumber;
    const content = currentChunkBlocks.map((b) => b.text).join("\n\n").trim();
    const sectionHeading = currentChunkBlocks.find((b) => b.heading !== null)?.heading ?? null;
    const tokenCount = estimateTokens(content);

    rawChunks.push({
      chunkIndex: chunkIndex++,
      pageStart,
      pageEnd,
      sectionHeading,
      content,
      tokenCount,
    });

    // Prepare overlap for next chunk
    if (overlapTokens > 0) {
      const overlapBlocks: TextBlock[] = [];
      let overlapCount = 0;
      for (let i = currentChunkBlocks.length - 1; i >= 0; i--) {
        const b = currentChunkBlocks[i];
        overlapBlocks.unshift(b);
        overlapCount += b.tokenCount;
        if (overlapCount >= overlapTokens) break;
      }
      currentChunkBlocks = overlapBlocks;
      currentTokens = overlapCount;
      hasNewContentInChunk = false;
    } else {
      currentChunkBlocks = [];
      currentTokens = 0;
      hasNewContentInChunk = false;
    }
  }

  for (const block of blocks) {
    // If a single block alone is gigantic (> maxTokens), split it into sub-segments
    if (block.tokenCount > maxTokens) {
      if (currentTokens > 0 && hasNewContentInChunk) {
        finalizeCurrentChunk();
      } else {
        currentChunkBlocks = [];
        currentTokens = 0;
        hasNewContentInChunk = false;
      }

      const segments = splitOversizedBlock(block.text, maxTokens);
      for (const segment of segments) {
        const segTrimmed = segment.trim();
        if (!segTrimmed) continue;
        const segTokens = estimateTokens(segTrimmed);

        if (currentTokens + segTokens > maxTokens) {
          if (currentTokens >= minTokens || hasNewContentInChunk) {
            finalizeCurrentChunk();
            if (currentTokens + segTokens > maxTokens) {
              currentChunkBlocks = [];
              currentTokens = 0;
            }
          } else {
            currentChunkBlocks = [];
            currentTokens = 0;
          }
        }

        currentChunkBlocks.push({
          text: segTrimmed,
          pageNumber: block.pageNumber,
          heading: block.heading,
          tokenCount: segTokens,
        });
        currentTokens += segTokens;
        hasNewContentInChunk = true;
      }
      continue;
    }

    if (currentTokens + block.tokenCount > maxTokens) {
      if (currentTokens >= minTokens || hasNewContentInChunk) {
        finalizeCurrentChunk();
        if (currentTokens + block.tokenCount > maxTokens) {
          currentChunkBlocks = [];
          currentTokens = 0;
        }
      } else {
        currentChunkBlocks = [];
        currentTokens = 0;
      }
    }

    currentChunkBlocks.push(block);
    currentTokens += block.tokenCount;
    hasNewContentInChunk = true;
  }

  // Final flush
  if (currentChunkBlocks.length > 0 && hasNewContentInChunk) {
    const content = currentChunkBlocks.map((b) => b.text).join("\n\n").trim();
    if (content.length > 0) {
      const pageStart = currentChunkBlocks[0].pageNumber;
      const pageEnd = currentChunkBlocks[currentChunkBlocks.length - 1].pageNumber;
      const sectionHeading = currentChunkBlocks.find((b) => b.heading !== null)?.heading ?? null;
      rawChunks.push({
        chunkIndex: chunkIndex++,
        pageStart,
        pageEnd,
        sectionHeading,
        content,
        tokenCount: estimateTokens(content),
      });
    }
  }

  return rawChunks;
}
