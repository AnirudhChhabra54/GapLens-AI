// ==============================================================================
// GapLens AI — PDF Text Extraction Engine (unpdf)
// Preserves 1-based page metadata, character metrics, and detects scanned/image PDFs
// ==============================================================================

import { extractText } from "unpdf";
import type { DocumentParseResult, ExtractedPage } from "@/types/rag";

export const MIN_CHARS_PER_PAGE_THRESHOLD = 50;

export interface ParsePdfOptions {
  filename?: string;
  minCharsPerPage?: number;
}

/**
 * Extracts text page-by-page from a PDF buffer using unpdf.
 * Preserves 1-based page numbering and flags scanned/image documents as `needsOcr: true`.
 */
export async function parsePdfBuffer(
  buffer: Buffer | Uint8Array | ArrayBuffer,
  options: ParsePdfOptions = {}
): Promise<DocumentParseResult> {
  const filename = options.filename ?? "document.pdf";
  const minCharsPerPage = options.minCharsPerPage ?? MIN_CHARS_PER_PAGE_THRESHOLD;

  try {
    // Convert Buffer/ArrayBuffer to Uint8Array if needed by pdf.js
    let uint8Data: Uint8Array;
    if (buffer instanceof Uint8Array) {
      uint8Data = buffer;
    } else if (buffer instanceof ArrayBuffer) {
      uint8Data = new Uint8Array(buffer);
    } else {
      uint8Data = new Uint8Array(buffer);
    }

    const { totalPages, text } = await extractText(uint8Data, { mergePages: false });

    const pages: ExtractedPage[] = [];
    const textList: string[] = Array.isArray(text) ? text : [text];

    for (let i = 0; i < textList.length; i++) {
      const pageText = (textList[i] ?? "").trim();
      pages.push({
        pageNumber: i + 1, // 1-based index
        text: pageText,
        charCount: pageText.length,
      });
    }

    const pageCount = Math.max(totalPages, pages.length);
    const extractedCharCount = pages.reduce((sum, p) => sum + p.charCount, 0);
    const avgCharsPerPage = pageCount > 0 ? extractedCharCount / pageCount : 0;

    let needsOcr = false;
    let ocrReason: string | undefined = undefined;

    if (pageCount === 0) {
      needsOcr = true;
      ocrReason = "PDF contains zero pages or could not be decoded.";
    } else if (extractedCharCount === 0 || avgCharsPerPage < minCharsPerPage) {
      needsOcr = true;
      ocrReason = `Scanned image PDF detected with minimal selectable text (${avgCharsPerPage.toFixed(1)} chars/page < ${minCharsPerPage} threshold). OCR processing required.`;
    }

    return {
      filename,
      pageCount,
      extractedCharCount,
      pages,
      needsOcr,
      ocrReason,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      filename,
      pageCount: 0,
      extractedCharCount: 0,
      pages: [],
      needsOcr: true,
      ocrReason: `Failed to parse PDF binary: ${errorMsg}`,
    };
  }
}
