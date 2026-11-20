// ==============================================================================
// GapLens AI — Unit Tests: Upload Sign Route (`/api/upload/sign`)
// ==============================================================================

import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/upload/sign/route";

describe("Unit: POST /api/upload/sign", () => {
  const validPayload = {
    workspaceId: "10000000-0000-0000-0000-000000000001",
    filename: "lecture_slides.pdf",
    fileType: "application/pdf",
    declaredSizeBytes: 1024 * 1024,
    docType: "material",
  };

  it("should generate a signed upload URL for valid parameters", async () => {
    const req = new Request("http://localhost:3000/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.uploadUrl).toBeDefined();
    expect(data.storagePath).toContain("10000000-0000-0000-0000-000000000001");
    expect(data.storagePath).toContain("lecture_slides.pdf");
    expect(data.documentId).toBeDefined();
    expect(data.bucket).toBe("documents");
  });

  it("should reject unsupported MIME types with 415 status", async () => {
    const req = new Request("http://localhost:3000/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        fileType: "application/x-msdownload",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(415);
    const data = await res.json();
    expect(data.error).toContain("Unsupported file type");
  });

  it("should reject file sizes exceeding 50MB with 400 status", async () => {
    const req = new Request("http://localhost:3000/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        declaredSizeBytes: 60 * 1024 * 1024, // 60MB
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request parameters");
  });

  it("should reject invalid UUIDs for workspaceId", async () => {
    const req = new Request("http://localhost:3000/api/upload/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        workspaceId: "not-a-valid-uuid",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
