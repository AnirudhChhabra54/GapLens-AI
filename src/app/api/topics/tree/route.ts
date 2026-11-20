// ==============================================================================
// GapLens AI — Topic Hierarchy Tree API Route
// GET /api/topics/tree?workspaceId=...
// Returns nested hierarchical topic tree with prerequisite relationships and mastery status.
// ==============================================================================

import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { buildTopicTree } from "@/lib/algorithms/topic-mapper";
import { DEMO_TOPICS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Query parameter 'workspaceId' is required" },
        { status: 400 }
      );
    }

    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isLiveDb = isSupabaseAdminConfigured() && !auth.isDemo;
    const admin = getSupabaseAdmin();

    let topics: any[] = [];
    let prerequisites: any[] = [];

    if (isLiveDb) {
      const { data: topicData, error: topicErr } = await admin
        .from("topics")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("order_index", { ascending: true });

      if (topicErr) {
        return NextResponse.json(
          { error: "Failed to load workspace topics", details: topicErr.message },
          { status: 500 }
        );
      }

      const { data: prereqData, error: prereqErr } = await admin
        .from("topic_prerequisites")
        .select("*")
        .eq("workspace_id", workspaceId);

      if (prereqErr) {
        return NextResponse.json(
          { error: "Failed to load topic prerequisites", details: prereqErr.message },
          { status: 500 }
        );
      }

      topics = topicData || [];
      prerequisites = prereqData || [];
    } else if (auth.isDemo) {
      topics = DEMO_TOPICS;
      prerequisites = DEMO_PREREQUISITES;
    } else {
      topics = [];
      prerequisites = [];
    }

    const tree = buildTopicTree(topics, prerequisites);

    return NextResponse.json({
      success: true,
      workspaceId,
      isDemo: auth.isDemo,
      totalTopics: topics.length,
      tree,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to retrieve topic tree", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
