// ==============================================================================
// GapLens AI — Direct Storage Upload Signed URL Route
// Generates presigned upload URLs directly to private Supabase Storage bucket `documents`
// Bypasses Vercel serverless payload limits (50MB) and enforces tenant isolation.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import {
  isMissingSchemaError,
  schemaMissingPayload,
  SCHEMA_MISSING_MESSAGE,
} from "@/lib/supabase/errors";
import type { DocumentType, DocumentStatus } from "@/types/database";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = ["application/pdf", "text/plain", "text/markdown"];

const UploadSignRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  filename: z.string().min(1, "Filename cannot be empty"),
  fileType: z.string(),
  declaredSizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, "File exceeds maximum 50MB limit"),
  docType: z.enum(["syllabus", "material", "past_paper"]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = UploadSignRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, filename, fileType, declaredSizeBytes, docType } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `Unsupported file type '${fileType}'. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 415 }
      );
    }

    const userId = auth.userId;

    // Clean and sanitize filename
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${workspaceId}/${Date.now()}_${sanitizedFilename}`;

    let uploadUrl: string;
    let documentId: string = crypto.randomUUID();

    if (isSupabaseAdminConfigured() && !auth.isDemo) {
      const admin = getSupabaseAdmin();

      // Generate signed upload URL from Supabase Storage private bucket 'documents'
      let { data: uploadData, error: uploadError } = await admin.storage
        .from("documents")
        .createSignedUploadUrl(storagePath);

      // Auto-provision bucket if missing or not yet created in Supabase
      if (
        uploadError &&
        (uploadError.message?.toLowerCase().includes("not found") ||
          (uploadError as any).statusCode === 404 ||
          (uploadError as any).status === 404)
      ) {
        console.warn("[Upload Sign] 'documents' bucket missing in Supabase storage, creating it...");
        try {
          await admin.storage.createBucket("documents", {
            public: false,
            fileSizeLimit: MAX_UPLOAD_BYTES,
            allowedMimeTypes: ALLOWED_MIME_TYPES,
          });

          const retry = await admin.storage
            .from("documents")
            .createSignedUploadUrl(storagePath);
          uploadData = retry.data;
          uploadError = retry.error;
        } catch (bucketErr) {
          console.error("[Upload Sign] Failed to auto-create 'documents' bucket:", bucketErr);
        }
      }

      if (uploadError || !uploadData?.signedUrl) {
        console.error("[Upload Sign] Supabase storage error:", uploadError);
        return NextResponse.json(
          { error: "Failed to create signed upload URL in storage bucket", details: uploadError?.message },
          { status: 500 }
        );
      }

      uploadUrl = uploadData.signedUrl;

      // Insert record into documents table with status 'uploaded'
      const { data: docRow, error: docError } = await admin
        .from("documents")
        .insert({
          id: documentId,
          workspace_id: workspaceId,
          user_id: userId,
          filename: sanitizedFilename,
          storage_path: storagePath,
          file_type: fileType,
          declared_size_bytes: declaredSizeBytes,
          doc_type: docType as DocumentType,
          status: "uploaded" as DocumentStatus,
          page_count: 0,
          extracted_char_count: 0,
          chunk_count: 0,
          current_checkpoint: { step: "uploaded", timestamp: new Date().toISOString() },
          parser_version: "unpdf-v2.2",
          index_version: 1,
        })
        .select("id")
        .single();

      if (docError) {
        console.error("[Upload Sign] DB insert error:", docError);
        if (isMissingSchemaError(docError)) {
          return NextResponse.json({
            success: true,
            uploadUrl,
            storagePath,
            documentId,
            bucket: "documents",
            isOffline: true,
            warning: SCHEMA_MISSING_MESSAGE,
          });
        }
        return NextResponse.json(
          { error: "Failed to initialize document record in database", details: docError.message },
          { status: 500 }
        );
      }

      if (docRow?.id) {
        documentId = docRow.id;
      }
    } else {
      // Offline/Demo fallback signed URL
      uploadUrl = `https://mock-storage.supabase.co/storage/v1/object/upload/sign/documents/${encodeURIComponent(
        storagePath
      )}?token=mock_signed_token_${Date.now()}`;
    }

    return NextResponse.json({
      success: true,
      isDemo: auth.isDemo,
      documentId,
      uploadUrl,
      storagePath,
      bucket: "documents",
      maxSizeBytes: MAX_UPLOAD_BYTES,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Internal server error", details: errorMsg }, { status: 500 });
  }
}
