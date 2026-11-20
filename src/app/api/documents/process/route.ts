// ==============================================================================
// GapLens AI — Idempotent Document Ingestion Pipeline Route
// Executes bounded state transitions:
// uploaded -> extracting -> chunking -> embedding -> indexed (or needs_ocr / failed)
// Cleanses previous chunk versions on retry to ensure idempotency.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError, schemaMissingPayload } from "@/lib/supabase/errors";
import { parsePdfBuffer } from "@/lib/rag/pdf-parser";
import { chunkExtractedPages } from "@/lib/rag/chunker";
import {
  embedBatch,
  EMBEDDING_MODEL_NAME,
  TARGET_EMBEDDING_DIMENSIONS,
  generateDeterministic768dEmbedding,
} from "@/lib/ai/gemini";
import type { DocumentStatus, DocumentChunkRow, DocumentType } from "@/types/database";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

const ProcessDocumentRequestSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  workspaceId: z.string().uuid("Invalid workspace ID").optional(),
  filename: z.string().optional(),
  fileBase64: z.string().optional(),
  docType: z.enum(["syllabus", "material", "past_paper"]).optional(),
  indexVersion: z.number().int().min(1).default(1),
  maxChunks: z.number().int().positive().optional(),
  ocrText: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = ProcessDocumentRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      documentId,
      workspaceId: clientWorkspaceId,
      filename: clientFilename,
      fileBase64,
      docType: clientDocType,
      indexVersion,
      maxChunks,
      ocrText,
    } = parsed.data;

    const isLiveDb = isSupabaseAdminConfigured();
    const admin = getSupabaseAdmin();

    let filename = clientFilename || "uploaded_document.pdf";
    let workspaceId = clientWorkspaceId || "10000000-0000-0000-0000-000000000001";
    let userId = "00000000-0000-0000-0000-000000000001";
    let storagePath: string | null = null;
    let docType: DocumentType = clientDocType || "material";

    // Step 0: Check document metadata if DB is configured
    if (isLiveDb) {
      const { data: doc, error: fetchErr } = await admin
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (doc) {
        filename = doc.filename || filename;
        workspaceId = doc.workspace_id || workspaceId;
        userId = doc.user_id || userId;
        storagePath = doc.storage_path || storagePath;
        docType = (doc.doc_type as DocumentType) || docType;
      } else if (fetchErr && !fileBase64 && !ocrText?.trim()) {
        // Document not found and no recoverable payload (uploaded file or OCR text).
        if (isMissingSchemaError(fetchErr)) {
          return NextResponse.json(schemaMissingPayload(), { status: 503 });
        }
        return NextResponse.json(
          { error: `Document '${documentId}' not found in database.` },
          { status: 404 }
        );
      }
    }

    // Verify document/workspace ownership before expensive processing.
    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.userId) {
      userId = auth.userId;
    }

    const persistToDb = isLiveDb && !auth.isDemo;
    if (persistToDb && auth.userId !== userId) {
      return NextResponse.json(
        { error: "You do not have access to this document." },
        { status: 403 }
      );
    }

    // Helper to update status in DB
    const updateDocumentStatus = async (
      status: DocumentStatus,
      checkpoint: Record<string, any>,
      extra?: Record<string, any>
    ) => {
      if (persistToDb) {
        await admin
          .from("documents")
          .update({
            status,
            current_checkpoint: checkpoint,
            updated_at: new Date().toISOString(),
            ...extra,
          })
          .eq("id", documentId);
      }
    };

    // Step 1: Transition -> extracting
    await updateDocumentStatus("extracting", { step: "extracting", startedAt: new Date().toISOString() });

    // Early size check on base64 input before decoding
    if (fileBase64) {
      const cleanLen = fileBase64.includes(",") ? fileBase64.split(",")[1].length : fileBase64.length;
      if ((cleanLen * 3) / 4 > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "File exceeds maximum allowed size of 50MB." },
          { status: 413 }
        );
      }
    }

    // Step 2: Fetch and validate file buffer.
    // When the caller supplies OCR/transcribed text we do not need the binary at all.
    let pdfBuffer: Buffer;
    if (ocrText && ocrText.trim().length > 0) {
      pdfBuffer = Buffer.from(ocrText, "utf-8");
    } else if (persistToDb && storagePath) {
      const { data: fileData, error: downloadErr } = await admin.storage
        .from("documents")
        .download(storagePath);

      if (downloadErr || !fileData) {
        if (!fileBase64) {
          await updateDocumentStatus("failed", { step: "download_failed", error: downloadErr?.message });
          return NextResponse.json(
            { error: "Failed to download document from storage", details: downloadErr?.message },
            { status: 500 }
          );
        }
        // Validated fallback if storage download temporary issue occurs
        const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
        pdfBuffer = Buffer.from(cleanBase64, "base64");
      } else {
        pdfBuffer = Buffer.from(await fileData.arrayBuffer());
      }
    } else if (fileBase64) {
      // Clean possible data URI scheme prefix (e.g. data:application/pdf;base64,)
      const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      pdfBuffer = Buffer.from(cleanBase64, "base64");
    } else if (storagePath && isLiveDb) {
      const { data: fileData, error: downloadErr } = await admin.storage
        .from("documents")
        .download(storagePath);

      if (downloadErr || !fileData) {
        await updateDocumentStatus("failed", { step: "download_failed", error: downloadErr?.message });
        return NextResponse.json(
          { error: "Failed to download document from storage", details: downloadErr?.message },
          { status: 500 }
        );
      }
      pdfBuffer = Buffer.from(await fileData.arrayBuffer());
    } else {
      // Offline fallback: Generate minimal textual demonstration buffer
      pdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 55>>stream\nBT /F1 12 Tf 72 712 Td (Operating System Process Scheduling) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000105 00000 n \n0000000188 00000 n \ntrailer<</Size 5/Root 1 0 R>>\nstartxref\n293\n%%EOF"
      );
    }

    if (pdfBuffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum allowed size of 50MB." },
        { status: 413 }
      );
    }

    // Step 3: Run Text Extraction (OCR-resolved text, PDF or plain text/Markdown)
    const lowerFilename = filename.toLowerCase();
    const isTextFile =
      lowerFilename.endsWith(".txt") ||
      lowerFilename.endsWith(".md") ||
      lowerFilename.endsWith(".markdown");
    let parseResult;

    if (ocrText && ocrText.trim().length > 0) {
      const sections = ocrText.split(/(?=\n#{1,3}\s)|\f/);
      const pages = sections
        .map((s, idx) => ({
          pageNumber: idx + 1,
          text: s.trim(),
          charCount: s.trim().length,
        }))
        .filter((p) => p.charCount > 0);

      parseResult = {
        filename,
        pageCount: Math.max(1, pages.length),
        extractedCharCount: ocrText.length,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: ocrText.trim(), charCount: ocrText.trim().length }],
        needsOcr: false,
      };
    } else {
      if (isTextFile) {
        const text = pdfBuffer.toString("utf-8");
        // Split into sections by markdown headings, form feeds, or double line-breaks
        const sections = text.split(/(?=\n#{1,3}\s)|\f/);
        const pages = sections
          .map((s, idx) => ({
            pageNumber: idx + 1,
            text: s.trim(),
            charCount: s.trim().length,
          }))
          .filter((p) => p.charCount > 0);

        parseResult = {
          filename,
          pageCount: Math.max(1, pages.length),
          extractedCharCount: text.length,
          pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: text.trim(), charCount: text.trim().length }],
          needsOcr: false,
        };
      } else {
        parseResult = await parsePdfBuffer(pdfBuffer, { filename });
      }
    }

    if (parseResult.needsOcr) {
      await updateDocumentStatus(
        "needs_ocr",
        { step: "needs_ocr", reason: parseResult.ocrReason },
        {
          page_count: parseResult.pageCount,
          extracted_char_count: parseResult.extractedCharCount,
          error_message: parseResult.ocrReason,
        }
      );

      return NextResponse.json({
        success: false,
        status: "needs_ocr" as DocumentStatus,
        documentId,
        pageCount: parseResult.pageCount,
        extractedCharCount: parseResult.extractedCharCount,
        ocrReason: parseResult.ocrReason,
      });
    }

    // Step 4: Transition -> chunking
    await updateDocumentStatus("chunking", {
      step: "chunking",
      pageCount: parseResult.pageCount,
      extractedCharCount: parseResult.extractedCharCount,
    });

    const allChunks = chunkExtractedPages(parseResult.pages);
    const rawChunks = maxChunks && maxChunks > 0 ? allChunks.slice(0, maxChunks) : allChunks;

    // Step 5: Transition -> embedding
    await updateDocumentStatus("embedding", {
      step: "embedding",
      chunkCount: rawChunks.length,
    });

    const textContents = rawChunks.map((c) => c.content);
    const embeddingResults = await embedBatch(textContents);

    // Step 6: Idempotent Database Chunk Upsert
    if (persistToDb) {
      // Ensure document row exists in documents table to satisfy foreign key constraints
      await admin.from("documents").upsert(
        {
          id: documentId,
          workspace_id: workspaceId,
          user_id: userId,
          filename,
          storage_path: storagePath || `${userId}/${workspaceId}/${documentId}_${filename}`,
          file_type: isTextFile ? "text/plain" : "application/pdf",
          declared_size_bytes: pdfBuffer.length,
          doc_type: docType,
          status: "embedding",
          page_count: parseResult.pageCount,
          extracted_char_count: parseResult.extractedCharCount,
          chunk_count: rawChunks.length,
          current_checkpoint: { step: "embedding" },
          index_version: indexVersion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      // Delete existing chunks for this document and index version to prevent duplicates on retry
      await admin
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId)
        .eq("index_version", indexVersion);

      const chunkRowsToInsert = rawChunks.map((chunk, i) => {
        const emb = embeddingResults[i] || {
          embedding: generateDeterministic768dEmbedding(chunk.content),
          model: EMBEDDING_MODEL_NAME,
          dimensions: TARGET_EMBEDDING_DIMENSIONS,
          isMock: true,
        };
        return {
          id: crypto.randomUUID(),
          document_id: documentId,
          workspace_id: workspaceId,
          user_id: userId,
          chunk_index: chunk.chunkIndex,
          index_version: indexVersion,
          page_start: chunk.pageStart,
          page_end: chunk.pageEnd,
          section_heading: chunk.sectionHeading,
          content: chunk.content,
          embedding: emb.embedding,
          embedding_model: emb.model,
          embedding_dimensions: emb.dimensions,
        };
      });

      if (chunkRowsToInsert.length > 0) {
        const { error: chunkInsertErr } = await admin.from("document_chunks").insert(chunkRowsToInsert);
        if (chunkInsertErr) {
          console.error("[Ingestion Process] Chunk insert error:", chunkInsertErr);
          await updateDocumentStatus("failed", { step: "chunk_insert_failed", error: chunkInsertErr.message });
          return NextResponse.json(
            { error: "Failed to save document chunks into database", details: chunkInsertErr.message },
            { status: 500 }
          );
        }
      }
    }

    // Step 7: Transition -> indexed
    await updateDocumentStatus(
      "indexed",
      { step: "indexed", completedAt: new Date().toISOString() },
      {
        page_count: parseResult.pageCount,
        extracted_char_count: parseResult.extractedCharCount,
        chunk_count: rawChunks.length,
        error_message: null,
      }
    );

    return NextResponse.json({
      success: true,
      documentId,
      status: "indexed" as DocumentStatus,
      pageCount: parseResult.pageCount,
      extractedCharCount: parseResult.extractedCharCount,
      chunkCount: rawChunks.length,
      chunks: rawChunks.map((c, i) => ({
        chunkIndex: c.chunkIndex,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        sectionHeading: c.sectionHeading,
        tokenCount: c.tokenCount,
        embeddingDimensions: embeddingResults[i]?.dimensions ?? TARGET_EMBEDDING_DIMENSIONS,
        isMockEmbedding: embeddingResults[i]?.isMock ?? true,
      })),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal processing error", details: errorMsg }, { status: 500 });
  }
}
