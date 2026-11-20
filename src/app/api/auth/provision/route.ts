// ==============================================================================
// GapLens AI — Server-Side Workspace & Profile Provisioning Route
// POST /api/auth/provision
// Atomically provisions a profile and default workspace for authenticated users.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import {
  isMissingSchemaError,
  schemaMissingPayload,
  SCHEMA_MISSING_MESSAGE,
} from "@/lib/supabase/errors";

const ProvisionRequestSchema = z.object({
  fullName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            "Supabase credentials are not configured on the server. Please launch the 1-click Demo workspace.",
        },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication is required to provision a workspace." },
        { status: 401 }
      );
    }

    let fullName: string | undefined;
    try {
      const json = await request.json();
      const parsed = ProvisionRequestSchema.safeParse(json);
      if (parsed.success) {
        fullName = parsed.data.fullName;
      }
    } catch {
      // Body is optional
    }

    const admin = getSupabaseAdmin();
    const resolvedName = fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "Student";
    const resolvedEmail = user.email || `${user.id}@student.gaplens.local`;

    const fallbackProfile = {
      id: user.id,
      email: resolvedEmail,
      full_name: resolvedName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const fallbackWorkspace = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: "My Course Workspace",
      description: "Active course workspace for syllabus mapping, diagnostic assessments, and study planning.",
      daily_study_minutes: 60,
      exam_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Upsert Profile
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: resolvedEmail,
          full_name: resolvedName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (profileError || !profile) {
      if (isMissingSchemaError(profileError)) {
        return NextResponse.json({
          success: true,
          profile: fallbackProfile,
          workspace: fallbackWorkspace,
          documents: [],
          topics: [],
          prerequisites: [],
          isUnmigrated: true,
          warning: SCHEMA_MISSING_MESSAGE,
        });
      }
      return NextResponse.json(
        { error: "Failed to provision user profile", details: profileError?.message },
        { status: 500 }
      );
    }

    // 2. Fetch existing workspace or create a canonical default workspace
    let workspace;
    const { data: existingWorkspace, error: fetchWsError } = await admin
      .from("workspaces")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchWsError) {
      if (isMissingSchemaError(fetchWsError)) {
        return NextResponse.json({
          success: true,
          profile: profile || fallbackProfile,
          workspace: fallbackWorkspace,
          documents: [],
          topics: [],
          prerequisites: [],
          isUnmigrated: true,
          warning: SCHEMA_MISSING_MESSAGE,
        });
      }
      return NextResponse.json(
        { error: "Failed to query workspace", details: fetchWsError.message },
        { status: 500 }
      );
    }

    if (existingWorkspace) {
      workspace = existingWorkspace;
    } else {
      const { data: createdWorkspace, error: createWsError } = await admin
        .from("workspaces")
        .insert({
          user_id: user.id,
          title: "My Course Workspace",
          description: "Active course workspace for syllabus mapping, diagnostic assessments, and study planning.",
          daily_study_minutes: 60,
          exam_date: null,
        })
        .select()
        .single();

      if (createWsError || !createdWorkspace) {
        if (isMissingSchemaError(createWsError)) {
          return NextResponse.json({
            success: true,
            profile: profile || fallbackProfile,
            workspace: fallbackWorkspace,
            documents: [],
            topics: [],
            prerequisites: [],
            isUnmigrated: true,
            warning: SCHEMA_MISSING_MESSAGE,
          });
        }
        return NextResponse.json(
          { error: "Failed to create default workspace", details: createWsError?.message },
          { status: 500 }
        );
      }
      workspace = createdWorkspace;
    }

    // 3. Fetch initial materials and topics
    const { data: documents } = await admin
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    const { data: topics } = await admin
      .from("topics")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("order_index", { ascending: true });

    const { data: prerequisites } = await admin
      .from("topic_prerequisites")
      .select("*")
      .eq("workspace_id", workspace.id);

    return NextResponse.json({
      success: true,
      profile,
      workspace,
      documents: documents || [],
      topics: topics || [],
      prerequisites: prerequisites || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal provisioning error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
