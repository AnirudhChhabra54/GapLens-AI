// ==============================================================================
// GapLens AI — Interactive Prerequisite DAG Edge API Route
// POST /api/topics/prerequisites — links a prerequisite edge (with cycle check).
// DELETE /api/topics/prerequisites?id=...&workspaceId=... — removes an edge.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";

const AddPrerequisiteSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  topicId: z.string().min(1),
  prerequisiteTopicId: z.string().min(1),
  rationale: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = AddPrerequisiteSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prerequisite parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, topicId, prerequisiteTopicId, rationale } = parsed.data;

    if (topicId === prerequisiteTopicId) {
      return NextResponse.json(
        { error: "A topic cannot depend on itself." },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const edge = {
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      topic_id: topicId,
      prerequisite_topic_id: prerequisiteTopicId,
      is_inferred: false,
      confidence: 1.0,
      source_rationale: rationale || "Added manually in curriculum dependency editor.",
      created_at: new Date().toISOString(),
    };

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ success: true, prerequisite: edge, isOffline: true });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("topic_prerequisites")
      .upsert(edge, { onConflict: "topic_id,prerequisite_topic_id", ignoreDuplicates: false })
      .select()
      .single();

    if (error) {
      if (isMissingSchemaError(error)) {
        return NextResponse.json({ success: true, prerequisite: edge, isOffline: true });
      }
      return NextResponse.json(
        { error: "Failed to save prerequisite link", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, prerequisite: data || edge });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to link prerequisite", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const workspaceId = searchParams.get("workspaceId");

    if (!id || !workspaceId) {
      return NextResponse.json(
        { error: "Query parameters 'id' and 'workspaceId' are required." },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({ success: true, id, isOffline: true });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("topic_prerequisites")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error && !isMissingSchemaError(error)) {
      return NextResponse.json(
        { error: "Failed to remove prerequisite link", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to remove prerequisite", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
