// ==============================================================================
// GapLens AI — Revision Planner API Route
// POST /api/planner/generate
// Calculates multi-factor priority scores, renormalizes weights when past papers are missing,
// and greedily packs revision tasks respecting daily available study minutes.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { rankTopicsByPriority, type RawTopicFactorsInput } from "@/lib/algorithms/priority";
import { generateRevisionPlan } from "@/lib/algorithms/scheduler";
import type { ScheduledTask, RevisionPlanOverview } from "@/types/planner";
import { DEMO_TOPICS, DEMO_PREREQUISITES, DEMO_REVISION_TASKS } from "@/lib/demo/os-cs301-fixture";

const GeneratePlanRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  dailyMinutes: z.number().int().min(10).max(480).default(60),
  daysRemaining: z.number().int().min(1).max(365).default(7),
  examDate: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = GeneratePlanRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, dailyMinutes, daysRemaining, examDate } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let prerequisites: any[] = [];
    let existingTasks: ScheduledTask[] = [];
    let existingPlanVersion = 0;
    let existingPlanId: string | null = null;

    if (isLiveDb) {
      const { data: topicData } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);

      const { data: prereqData } = await admin
        .from("topic_prerequisites")
        .select("*")
        .eq("workspace_id", workspaceId);

      const { data: planData } = await admin
        .from("revision_plans")
        .select("id, version")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      existingPlanId = planData?.id || null;
      existingPlanVersion = planData?.version || 0;

      const { data: taskData } = planData
        ? await admin.from("revision_tasks").select("*").eq("plan_id", planData.id)
        : { data: null };

      if (topicData && topicData.length > 0) topics = topicData;
      if (prereqData) prerequisites = prereqData;
      if (taskData) {
        existingTasks = taskData.map((t) => ({
          id: t.id,
          planId: t.plan_id,
          topicId: t.topic_id,
          topicTitle: t.title.split(": ")[1] || t.title,
          dayNumber: t.day_number,
          taskOrder: t.task_order,
          taskType: t.task_type,
          title: t.title,
          description: t.description || "",
          allocatedMinutes: t.allocated_minutes,
          priorityScore: t.priority_score,
          status: t.status,
          sourceChunkId: t.source_chunk_id,
          citationReference: t.citation_reference,
          completedAt: t.completed_at,
        }));
      }
    }

    if (topics.length === 0) topics = DEMO_TOPICS;
    if (prerequisites.length === 0) prerequisites = DEMO_PREREQUISITES;
    if (existingTasks.length === 0) {
      existingTasks = DEMO_REVISION_TASKS.map((t) => ({
        id: t.id,
        planId: t.plan_id,
        topicId: t.topic_id,
        topicTitle: t.title.split(": ")[1] || t.title,
        dayNumber: t.day_number,
        taskOrder: t.task_order,
        taskType: t.task_type,
        title: t.title,
        description: t.description || "",
        allocatedMinutes: t.allocated_minutes,
        priorityScore: t.priority_score,
        status: t.status,
        sourceChunkId: t.source_chunk_id,
        citationReference: t.citation_reference,
        completedAt: t.completed_at,
      }));
    }

    // Compute downstream dependents count per topic
    const dependentCounts = new Map<string, number>();
    for (const p of prerequisites) {
      const current = dependentCounts.get(p.prerequisite_topic_id) || 0;
      dependentCounts.set(p.prerequisite_topic_id, current + 1);
    }

    const rawFactors: RawTopicFactorsInput[] = topics.map((t) => ({
      topicId: t.id,
      topicTitle: t.title,
      masteryScore: t.current_mastery ?? 45.0,
      examWeight: t.exam_weight ?? 0.0,
      blindSpotCount: t.blind_spot_count ?? 0,
      totalAttempts: t.total_attempts ?? 0,
      downstreamDependentsCount: dependentCounts.get(t.id) || 0,
      totalTopicsCount: topics.length,
    }));

    // Rank topics with automatic weight renormalization
    const prioritizedTopics = rankTopicsByPriority(rawFactors);

    // Topic metadata mapping for citations
    const metaMap = new Map<string, { sourceChunkId?: string; citationReference?: string }>();
    for (const t of topics) {
      metaMap.set(t.id, {
        sourceChunkId: t.source_chunk_id,
        citationReference: t.unit_module ? `${t.unit_module}: ${t.title}` : t.title,
      });
    }

    const planOverview: RevisionPlanOverview = generateRevisionPlan({
      planId: existingPlanId || `plan-${workspaceId}`,
      version: existingPlanVersion + 1,
      workspaceId,
      prioritizedTopics,
      dailyMinutes,
      daysRemaining,
      examDate: examDate || null,
      existingTasks,
      topicMetadataMap: metaMap,
    });

    if (isLiveDb) {
      // Upsert revision plan
      await admin.from("revision_plans").upsert({
        id: planOverview.id,
        workspace_id: workspaceId,
        user_id: auth.userId,
        version: planOverview.version,
        exam_date: planOverview.examDate,
        daily_minutes: planOverview.dailyMinutes,
        total_days: planOverview.totalDays,
        total_allocated_minutes: planOverview.totalAllocatedMinutes,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      // Replace pending tasks; completed/skipped history is preserved.
      await admin
        .from("revision_tasks")
        .delete()
        .eq("plan_id", planOverview.id)
        .eq("status", "pending");

      for (const day of planOverview.days) {
        for (const task of day.tasks) {
          if (task.status === "pending") {
            await admin.from("revision_tasks").upsert({
              id: task.id,
              plan_id: planOverview.id,
              workspace_id: workspaceId,
              topic_id: task.topicId,
              day_number: task.dayNumber,
              task_order: task.taskOrder,
              task_type: task.taskType,
              title: task.title,
              description: task.description,
              allocated_minutes: task.allocatedMinutes,
              priority_score: task.priorityScore,
              status: task.status,
              source_chunk_id: task.sourceChunkId,
              citation_reference: task.citationReference,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...planOverview,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate revision plan", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
