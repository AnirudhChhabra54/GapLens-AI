// ==============================================================================
// GapLens AI — Unit Tests: Documents Process Route (`/api/documents/process`)
// ==============================================================================

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { POST } from "@/app/api/documents/process/route";

describe("Unit: POST /api/documents/process", () => {
  const samplePdfPath = path.join(process.cwd(), "tests", "fixtures", "sample-os-lecture.pdf");

  it("should process document with provided fileBase64 into indexed state", async () => {
    const pdfBuffer = fs.readFileSync(samplePdfPath);
    const fileBase64 = pdfBuffer.toString("base64");

    const req = new Request("http://localhost:3000/api/documents/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "20000000-0000-0000-0000-000000000001",
        fileBase64,
        indexVersion: 1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.status).toBe("indexed");
    expect(data.pageCount).toBe(3);
    expect(data.chunkCount).toBeGreaterThanOrEqual(1);
    expect(data.extractedCharCount).toBeGreaterThan(1000);
    expect(data.chunks).toHaveLength(data.chunkCount);
    expect(data.chunks[0].embeddingDimensions).toBe(768);
  });

  it("should detect scanned PDFs and transition to needs_ocr status", async () => {
    const scannedPdfStream =
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 18>>stream\nBT /F1 12 Tf ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000105 00000 n \n0000000188 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n256\n%%EOF";

    const base64Scanned = Buffer.from(scannedPdfStream).toString("base64");

    const req = new Request("http://localhost:3000/api/documents/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "20000000-0000-0000-0000-000000000099",
        fileBase64: base64Scanned,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.status).toBe("needs_ocr");
    expect(data.ocrReason).toContain("Scanned image PDF detected");
  });

  it("should reject invalid UUIDs for documentId with 400 status", async () => {
    const req = new Request("http://localhost:3000/api/documents/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "invalid-doc-id",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
