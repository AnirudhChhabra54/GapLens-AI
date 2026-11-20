// ==============================================================================
// GapLens AI — Workspace Settings & Updates API Route
// PATCH /api/workspaces/[id]
// Updates title, exam date, and daily study minutes for a workspace.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { DEMO_WORKSPACE } from "@/lib/demo/os-cs301-fixture";

const PatchWorkspaceSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  examDate: z.string().nullable().optional(),
  exam_date: z.string().nullable().optional(),
  dailyStudyMinutes: z.number().int().min(15).max(1440).optional(),
  daily_study_minutes: z.number().int().min(15).max(1440).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const workspaceId = params.id;
    const json = await request.json();
    const parsed = PatchWorkspaceSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid workspace settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { title, description } = parsed.data;
    const examDate = parsed.data.examDate !== undefined ? parsed.data.examDate : parsed.data.exam_date;
    const dailyStudyMinutes = parsed.data.dailyStudyMinutes ?? parsed.data.daily_study_minutes;

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        workspace: {
          ...DEMO_WORKSPACE,
          title: title ?? DEMO_WORKSPACE.title,
          description: description !== undefined ? description : DEMO_WORKSPACE.description,
          exam_date: examDate !== undefined ? examDate : DEMO_WORKSPACE.exam_date,
          daily_study_minutes: dailyStudyMinutes ?? DEMO_WORKSPACE.daily_study_minutes,
          updated_at: new Date().toISOString(),
        },
        isDemo: true,
      });
    }

    const admin = getSupabaseAdmin();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (title !== undefined) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (examDate !== undefined) updatePayload.exam_date = examDate;
    if (dailyStudyMinutes !== undefined) updatePayload.daily_study_minutes = dailyStudyMinutes;

    const { data: updatedWorkspace, error: updateErr } = await admin
      .from("workspaces")
      .update(updatePayload as any)
      .eq("id", workspaceId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update workspace", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: updatedWorkspace,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal workspace update error", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
