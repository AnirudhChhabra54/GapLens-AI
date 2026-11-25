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
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { rankTopicsByPriority, type RawTopicFactorsInput } from "@/lib/algorithms/priority";
import { generateRevisionPlan } from "@/lib/algorithms/scheduler";
import type { ScheduledTask, RevisionPlanOverview } from "@/types/planner";
import { DEMO_TOPICS, DEMO_PREREQUISITES, DEMO_REVISION_TASKS } from "@/lib/demo/os-cs301-fixture";

const GeneratePlanRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  dailyMinutes: z.number().int().min(10).max(1440).default(60),
  daysRemaining: z.number().int().min(1).max(365).default(7),
  examDate: z.string().nullable().optional(),
  topics: z.array(z.any()).optional(),
  prerequisites: z.array(z.any()).optional(),
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

    const { workspaceId, dailyMinutes, daysRemaining, examDate, topics: suppliedTopics, prerequisites: suppliedPrereqs } = parsed.data;

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    let isSchemaMissing = false;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let prerequisites: any[] = [];
    let existingTasks: ScheduledTask[] = [];
    let existingPlanVersion = 0;
    let existingPlanId: string | null = null;

    if (isLiveDb && !isSchemaMissing) {
      const { data: topicData, error: topicError } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (topicError) {
        if (isMissingSchemaError(topicError)) {
          isSchemaMissing = true;
        } else {
          return NextResponse.json(
            { error: "Failed to load workspace topics", details: topicError.message },
            { status: 500 }
          );
        }
      }

      if (!isSchemaMissing) {
        const { data: prereqData, error: prereqError } = await admin
          .from("topic_prerequisites")
          .select("*")
          .eq("workspace_id", workspaceId);
        if (prereqError) {
          if (isMissingSchemaError(prereqError)) {
            isSchemaMissing = true;
          } else {
            return NextResponse.json(
              { error: "Failed to load topic prerequisites", details: prereqError.message },
              { status: 500 }
            );
          }
        }

        const { data: planData, error: planError } = await admin
          .from("revision_plans")
          .select("id, version")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (planError) {
          if (isMissingSchemaError(planError)) {
            isSchemaMissing = true;
          } else {
            return NextResponse.json(
              { error: "Failed to load active revision plan", details: planError.message },
              { status: 500 }
            );
          }
        }

        existingPlanId = planData?.id || null;
        existingPlanVersion = planData?.version || 0;

        const { data: taskData, error: taskError } = planData
          ? await admin.from("revision_tasks").select("*").eq("plan_id", planData.id)
          : { data: null, error: null };
        if (taskError && !isMissingSchemaError(taskError)) {
          return NextResponse.json(
            { error: "Failed to load revision tasks", details: taskError.message },
            { status: 500 }
          );
        }

        topics = topicData || [];
        prerequisites = prereqData || [];
        if (taskData) {
          existingTasks = taskData.map((t) => ({
            id: t.id,
            planId: t.plan_id,
            topicId: t.topic_id,
            topicTitle: (t.title || "").includes(": ")
              ? (t.title || "").slice((t.title || "").indexOf(": ") + 2).trim()
              : t.title,
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

      if (topics.length === 0 && suppliedTopics && suppliedTopics.length > 0) {
        topics = suppliedTopics;
        prerequisites = suppliedPrereqs || [];
      }

      if (topics.length === 0) {
        return NextResponse.json(
          { error: "No indexed topics are available for this workspace. Extract the syllabus first." },
          { status: 422 }
        );
      }
    } else if (auth.isDemo) {
      topics = DEMO_TOPICS;
      prerequisites = DEMO_PREREQUISITES;
      existingTasks = DEMO_REVISION_TASKS.map((t) => ({
        id: t.id,
        planId: t.plan_id,
        topicId: t.topic_id,
        topicTitle: (t.title || "").includes(": ")
          ? (t.title || "").slice((t.title || "").indexOf(": ") + 2).trim()
          : t.title,
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
    } else {
      return NextResponse.json({
        success: true,
        id: crypto.randomUUID(),
        workspaceId,
        version: 1,
        examDate: examDate || null,
        dailyMinutes,
        totalDays: 0,
        totalAllocatedMinutes: 0,
        totalAvailableMinutes: 0,
        completedMinutes: 0,
        isActive: true,
        days: [],
        deferredTasksCount: 0,
      });
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
      planId: existingPlanId || crypto.randomUUID(),
      version: existingPlanVersion + 1,
      workspaceId,
      prioritizedTopics,
      dailyMinutes,
      daysRemaining,
      examDate: examDate || null,
      existingTasks,
      topicMetadataMap: metaMap,
    });

    if (isLiveDb && !isSchemaMissing) {
      // Deactivate any existing active plans in the workspace
      await admin
        .from("revision_plans")
        .update({ is_active: false })
        .eq("workspace_id", workspaceId)
        .neq("id", planOverview.id);

      // Upsert revision plan
      const { error: planUpsertError } = await admin.from("revision_plans").upsert({
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

      if (planUpsertError) {
        return NextResponse.json(
          { error: "Failed to save revision plan", details: planUpsertError.message },
          { status: 500 }
        );
      }

      // Replace pending tasks; completed/skipped history is preserved.
      const { error: deleteTasksError } = await admin
        .from("revision_tasks")
        .delete()
        .eq("plan_id", planOverview.id)
        .eq("status", "pending");

      if (deleteTasksError) {
        return NextResponse.json(
          { error: "Failed to replace pending revision tasks", details: deleteTasksError.message },
          { status: 500 }
        );
      }

      for (const day of planOverview.days) {
        for (const task of day.tasks) {
          if (task.status !== "pending") continue;

          const { error: taskInsertError } = await admin.from("revision_tasks").insert({
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

          if (taskInsertError) {
            return NextResponse.json(
              { error: "Failed to save revision tasks", details: taskInsertError.message },
              { status: 500 }
            );
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
