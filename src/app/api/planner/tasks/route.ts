// ==============================================================================
// GapLens AI — Revision Task Completion & Status API Route
// PATCH /api/planner/tasks
// Updates revision task status (completed, pending, skipped) and completed_at timestamp.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";

const PatchTaskSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  taskId: z.string().min(1, "Task ID is required"),
  status: z.enum(["pending", "completed", "skipped"]),
  completedAt: z.string().nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const parsed = PatchTaskSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, taskId, status, completedAt } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.isDemo || !isSupabaseAdminConfigured()) {
      return NextResponse.json({
        success: true,
        taskId,
        status,
        completedAt: status === "completed" ? (completedAt || new Date().toISOString()) : null,
        isDemo: true,
      });
    }

    const admin = getSupabaseAdmin();

    // Verify task exists and belongs to a plan in the authorized workspace
    const { data: task, error: fetchErr } = await admin
      .from("revision_tasks")
      .select("id, plan_id, revision_plans!inner(workspace_id)")
      .eq("id", taskId)
      .eq("revision_plans.workspace_id", workspaceId)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json(
        { error: "Failed to verify task ownership", details: fetchErr.message },
        { status: 500 }
      );
    }

    if (!task) {
      return NextResponse.json(
        { error: "Task not found in specified workspace" },
        { status: 404 }
      );
    }

    const resolvedCompletedAt = status === "completed" ? (completedAt || new Date().toISOString()) : null;

    const { data: updatedTask, error: updateErr } = await admin
      .from("revision_tasks")
      .update({
        status,
        completed_at: resolvedCompletedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to update task status", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      taskId,
      status: updatedTask.status,
      completedAt: updatedTask.completed_at,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to update revision task", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
