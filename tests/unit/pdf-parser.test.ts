// ==============================================================================
// GapLens AI — Unit Tests: PDF Parser (unpdf)
// ==============================================================================

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parsePdfBuffer, MIN_CHARS_PER_PAGE_THRESHOLD } from "@/lib/rag/pdf-parser";
import type { ExtractedPage } from "@/types/rag";

describe("Unit: PDF Parser (unpdf)", () => {
  const samplePdfPath = path.join(process.cwd(), "tests", "fixtures", "sample-os-lecture.pdf");

  it("should extract text from a genuine binary PDF buffer", async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    const pdfBuffer = fs.readFileSync(samplePdfPath);

    const result = await parsePdfBuffer(pdfBuffer, { filename: "sample-os-lecture.pdf" });

    expect(result.filename).toBe("sample-os-lecture.pdf");
    expect(result.pageCount).toBe(3);
    expect(result.extractedCharCount).toBeGreaterThan(1500);
    expect(result.needsOcr).toBe(false);
    expect(result.ocrReason).toBeUndefined();
    expect(result.pages).toHaveLength(3);
  });

  it("should enforce 1-based page numbering in page metadata", async () => {
    const pdfBuffer = fs.readFileSync(samplePdfPath);
    const result = await parsePdfBuffer(pdfBuffer);

    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[2].pageNumber).toBe(3);

    expect(result.pages[0].text).toContain("Chapter 1: Process Scheduling");
    expect(result.pages[1].text).toContain("Chapter 2: Virtual Memory");
    expect(result.pages[2].text).toContain("Chapter 3: Page Replacement");
  });

  it("should calculate exact character count per page and total character count", async () => {
    const pdfBuffer = fs.readFileSync(samplePdfPath);
    const result = await parsePdfBuffer(pdfBuffer);

    let sumChars = 0;
    for (const page of result.pages) {
      expect(page.charCount).toBe(page.text.length);
      expect(page.charCount).toBeGreaterThan(400);
      sumChars += page.charCount;
    }

    expect(result.extractedCharCount).toBe(sumChars);
  });

  it("should flag scanned/image PDFs as needs_ocr when character threshold is not met", async () => {
    // Generate a scanned-like PDF with minimal/no selectable text
    const scannedPdfStream =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 18>>stream\nBT /F1 12 Tf ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000105 00000 n \n0000000188 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n256\n%%EOF";

    const scannedBuffer = Buffer.from(scannedPdfStream);
    const result = await parsePdfBuffer(scannedBuffer, {
      filename: "scanned_exam_scan.pdf",
      minCharsPerPage: 50,
    });

    expect(result.needsOcr).toBe(true);
    expect(result.ocrReason).toBeDefined();
    expect(result.ocrReason).toContain("Scanned image PDF detected");
  });

  it("should handle corrupted binary buffers gracefully without uncaught exceptions", async () => {
    const corruptedBuffer = Buffer.from("NOT_A_VALID_PDF_BINARY_DATA_RANDOM_BYTES");
    const result = await parsePdfBuffer(corruptedBuffer, { filename: "corrupt.pdf" });

    expect(result.needsOcr).toBe(true);
    expect(result.ocrReason).toContain("Failed to parse PDF binary");
    expect(result.pages).toHaveLength(0);
  });
});
