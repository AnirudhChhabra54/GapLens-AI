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
import { parsePdfBuffer } from "@/lib/rag/pdf-parser";
import { chunkExtractedPages } from "@/lib/rag/chunker";
import { embedBatch, EMBEDDING_MODEL_NAME, TARGET_EMBEDDING_DIMENSIONS } from "@/lib/ai/gemini";
import type { DocumentStatus, DocumentChunkRow } from "@/types/database";

const ProcessDocumentRequestSchema = z.object({
  documentId: z.string().uuid("Invalid document ID"),
  fileBase64: z.string().optional(),
  indexVersion: z.number().int().min(1).default(1),
  maxChunks: z.number().int().positive().optional(),
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

    const { documentId, fileBase64, indexVersion } = parsed.data;
    const isLiveDb = isSupabaseAdminConfigured();
    const admin = getSupabaseAdmin();

    let filename = "uploaded_document.pdf";
    let workspaceId = "10000000-0000-0000-0000-000000000001";
    let userId = "00000000-0000-0000-0000-000000000001";
    let storagePath: string | null = null;

    // Step 0: Check document metadata if DB is configured
    if (isLiveDb) {
      const { data: doc, error: fetchErr } = await admin
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single();

      if (fetchErr || !doc) {
        return NextResponse.json(
          { error: `Document '${documentId}' not found in database.` },
          { status: 404 }
        );
      }

      filename = doc.filename;
      workspaceId = doc.workspace_id;
      userId = doc.user_id;
      storagePath = doc.storage_path;
    }

    // Verify document/workspace ownership before expensive processing.
    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (isLiveDb && auth.userId !== userId) {
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
      if (isLiveDb) {
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

    // Step 2: Fetch PDF buffer
    let pdfBuffer: Buffer;
    if (fileBase64) {
      pdfBuffer = Buffer.from(fileBase64, "base64");
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

    // Step 3: Run PDF Text Extraction
    const parseResult = await parsePdfBuffer(pdfBuffer, { filename });

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

    const rawChunks = chunkExtractedPages(parseResult.pages);

    // Step 5: Transition -> embedding
    await updateDocumentStatus("embedding", {
      step: "embedding",
      chunkCount: rawChunks.length,
    });

    const textContents = rawChunks.map((c) => c.content);
    const embeddingResults = await embedBatch(textContents);

    // Step 6: Idempotent Database Chunk Upsert
    if (isLiveDb) {
      // Delete existing chunks for this document and index version to prevent duplicates on retry
      await admin
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId)
        .eq("index_version", indexVersion);

      const chunkRowsToInsert = rawChunks.map((chunk, i) => {
        const emb = embeddingResults[i];
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
