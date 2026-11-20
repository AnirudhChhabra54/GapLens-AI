// ==============================================================================
// GapLens AI — Document Reindexing API Route
// POST /api/documents/[id]/reindex
// Clears stale chunks and re-runs parse -> chunk -> embed from stored file or payload.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { parsePdfBuffer } from "@/lib/rag/pdf-parser";
import { chunkExtractedPages } from "@/lib/rag/chunker";
import { embedBatch, generateDeterministic768dEmbedding } from "@/lib/ai/gemini";
import type { DocumentRow } from "@/types/database";

const ReindexRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  fileBase64: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    const json = await request.json();
    const parsed = ReindexRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, fileBase64 } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        documentId,
        isDemo: true,
        status: "indexed",
        chunkCount: 6,
        message: "Demo document reindexed successfully.",
      });
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch document record
    const { data: doc, error: fetchErr } = await admin
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (fetchErr || !doc) {
      return NextResponse.json(
        { error: "Document not found or inaccessible" },
        { status: 404 }
      );
    }

    const document = doc as DocumentRow;

    // 2. Obtain file buffer
    let buffer: Buffer;
    if (document.storage_path) {
      const { data: fileData, error: downloadErr } = await admin.storage
        .from("documents")
        .download(document.storage_path);

      if (downloadErr || !fileData) {
        if (!fileBase64) {
          return NextResponse.json(
            { error: "Could not download file from storage and no base64 fallback provided" },
            { status: 500 }
          );
        }
        const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
        buffer = Buffer.from(cleanBase64, "base64");
      } else {
        buffer = Buffer.from(await fileData.arrayBuffer());
      }
    } else if (fileBase64) {
      const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
      buffer = Buffer.from(cleanBase64, "base64");
    } else {
      return NextResponse.json(
        { error: "No storage path or file payload available to reindex document" },
        { status: 400 }
      );
    }

    // 3. Mark status as extracting
    await admin
      .from("documents")
      .update({
        status: "extracting",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    // 4. Parse text
    const lowerFilename = document.filename.toLowerCase();
    const isTextFile =
      lowerFilename.endsWith(".txt") ||
      lowerFilename.endsWith(".md") ||
      lowerFilename.endsWith(".markdown");

    let parseResult;
    if (isTextFile) {
      const text = buffer.toString("utf-8");
      const sections = text.split(/(?=\n#{1,3}\s)|\f/);
      const pages = sections
        .map((s, idx) => ({
          pageNumber: idx + 1,
          text: s.trim(),
          charCount: s.trim().length,
        }))
        .filter((p) => p.charCount > 0);

      parseResult = {
        filename: document.filename,
        pageCount: Math.max(1, pages.length),
        extractedCharCount: text.length,
        pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: text.trim(), charCount: text.trim().length }],
        needsOcr: false,
      };
    } else {
      parseResult = await parsePdfBuffer(buffer, { filename: document.filename });
    }

    if (parseResult.needsOcr) {
      await admin
        .from("documents")
        .update({
          status: "needs_ocr",
          error_message: parseResult.ocrReason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return NextResponse.json({
        success: false,
        status: "needs_ocr",
        documentId,
        ocrReason: parseResult.ocrReason,
      });
    }

    // 5. Chunk document
    const chunks = chunkExtractedPages(parseResult.pages);

    // 6. Generate embeddings
    const textContents = chunks.map((c) => c.content);
    let embeddingResults: Array<{ embedding: number[]; model: string; dimensions: number; isMock?: boolean }> = [];
    try {
      embeddingResults = await embedBatch(textContents);
    } catch (embErr) {
      console.warn("[Reindex] Embedding fallback notice:", embErr);
    }

    // 7. Clear old chunks and insert newly processed chunks
    await admin.from("document_chunks").delete().eq("document_id", documentId);

    const nextIndexVersion = (document.index_version || 1) + 1;

    const chunkRows = chunks.map((c, idx) => {
      const emb = embeddingResults[idx] || {
        embedding: generateDeterministic768dEmbedding(c.content),
        model: "deterministic-hash-v1",
        dimensions: 768,
      };
      return {
        id: crypto.randomUUID(),
        document_id: documentId,
        workspace_id: workspaceId,
        user_id: document.user_id || "00000000-0000-0000-0000-000000000001",
        chunk_index: c.chunkIndex,
        index_version: nextIndexVersion,
        page_start: c.pageStart,
        page_end: c.pageEnd,
        section_heading: c.sectionHeading || null,
        content: c.content,
        token_count: c.tokenCount,
        char_count: c.content.length,
        embedding: emb.embedding as unknown as string,
        embedding_model: emb.model,
        embedding_dimensions: emb.dimensions,
        created_at: new Date().toISOString(),
      };
    });

    if (chunkRows.length === 0) {
      await admin
        .from("documents")
        .update({
          status: "failed",
          error_message: "Reindex produced no chunks from the extracted text.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return NextResponse.json(
        { error: "Reindex failed: no text chunks were produced from this document." },
        { status: 422 }
      );
    }

    const { error: chunkInsertErr } = await admin
      .from("document_chunks")
      .insert(chunkRows as any);

    if (chunkInsertErr) {
      await admin
        .from("documents")
        .update({
          status: "failed",
          error_message: `Reindex chunk insert failed: ${chunkInsertErr.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      return NextResponse.json(
        { error: "Failed to save reindexed document chunks", details: chunkInsertErr.message },
        { status: 500 }
      );
    }

    // 8. Update document status to indexed
    const { data: updatedDoc, error: updateErr } = await admin
      .from("documents")
      .update({
        status: "indexed",
        page_count: parseResult.pageCount,
        extracted_char_count: parseResult.extractedCharCount,
        chunk_count: chunkRows.length,
        index_version: nextIndexVersion,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to finalize document reindexing", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      status: "indexed",
      chunkCount: chunkRows.length,
      indexVersion: nextIndexVersion,
      document: updatedDoc,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to reindex document", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
