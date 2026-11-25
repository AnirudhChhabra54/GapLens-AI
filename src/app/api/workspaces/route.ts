// ==============================================================================
// GapLens AI — Multi-Course Workspaces API Route
// GET /api/workspaces — lists workspaces owned by the authenticated user.
// POST /api/workspaces — creates a new course workspace.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { DEMO_WORKSPACE } from "@/lib/demo/os-cs301-fixture";

const CreateWorkspaceSchema = z.object({
  title: z.string().min(1, "Course title is required").max(120),
  description: z.string().max(400).nullable().optional(),
  examDate: z.string().nullable().optional(),
  dailyStudyMinutes: z.number().int().min(15).max(1440).default(60),
});

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({
        success: true,
        workspaces: [DEMO_WORKSPACE],
        isDemo: true,
      });
    }

    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        workspaces: [],
        isOffline: true,
      });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("workspaces")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingSchemaError(error)) {
        return NextResponse.json({
          success: true,
          workspaces: [],
          isOffline: true,
        });
      }
      return NextResponse.json(
        { error: "Failed to load workspaces", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspaces: data || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to list workspaces", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = CreateWorkspaceSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid workspace parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, examDate, dailyStudyMinutes } = parsed.data;
    const authUserId = await getAuthenticatedUserId();
    const userId = authUserId || "00000000-0000-0000-0000-000000000001";
    const now = new Date().toISOString();

    const newWorkspace = {
      id: crypto.randomUUID(),
      user_id: userId,
      title: title.trim(),
      description: description ?? null,
      exam_date: examDate || null,
      daily_study_minutes: dailyStudyMinutes,
      created_at: now,
      updated_at: now,
    };

    if (!authUserId || !isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        workspace: newWorkspace,
        isOffline: true,
      });
    }

    const admin = getSupabaseAdmin();
    const { data: inserted, error } = await admin
      .from("workspaces")
      .insert(newWorkspace)
      .select()
      .single();

    if (error) {
      if (isMissingSchemaError(error)) {
        return NextResponse.json({
          success: true,
          workspace: newWorkspace,
          isOffline: true,
        });
      }
      return NextResponse.json(
        { error: "Failed to create workspace", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: inserted || newWorkspace,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to create workspace", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
