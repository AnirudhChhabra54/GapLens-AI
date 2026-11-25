// ==============================================================================
// GapLens AI — Document Deletion API Route
// DELETE /api/documents/[id]?workspaceId=...
// Authorizes workspace ownership, removes stored file, and deletes database row + cascades.
// ==============================================================================

import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Query parameter 'workspaceId' is required." },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        documentId,
        isDemo: true,
        message: "Document removed from demo workspace view.",
      });
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch document to check existence and retrieve storage path
    const { data: document, error: fetchErr } = await admin
      .from("documents")
      .select("id, storage_path, workspace_id")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (fetchErr) {
      if (isMissingSchemaError(fetchErr)) {
        return NextResponse.json({
          success: true,
          documentId,
          isOffline: true,
          message: "Document removed from local workspace view (database schema not yet initialized).",
        });
      }
      return NextResponse.json(
        { error: "Failed to verify document existence", details: fetchErr.message },
        { status: 500 }
      );
    }

    if (!document) {
      return NextResponse.json(
        { error: "Document not found in specified workspace." },
        { status: 404 }
      );
    }

    // 2. Delete storage file if path exists
    if (document.storage_path) {
      try {
        await admin.storage.from("documents").remove([document.storage_path]);
      } catch (storageErr) {
        console.warn("[Documents Delete] Storage removal notice:", storageErr);
      }
    }

    // 3. Remove dependent chunks and paper questions
    await admin.from("document_chunks").delete().eq("document_id", documentId);
    await admin.from("paper_questions").delete().eq("document_id", documentId);

    // 4. Delete the document record
    const { error: deleteErr } = await admin
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("workspace_id", workspaceId);

    if (deleteErr) {
      return NextResponse.json(
        { error: "Failed to delete document from database", details: deleteErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId,
      message: "Document, chunks, and storage objects deleted successfully.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to delete document", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
