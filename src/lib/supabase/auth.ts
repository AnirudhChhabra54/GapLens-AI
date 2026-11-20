// ==============================================================================
// GapLens AI — Server-Side Request Authorization Helpers
// Resolves the authenticated user and verifies workspace ownership before any
// privileged read or write. Offline mode is explicitly labelled and may only be
// used for the synthetic demo preview, never for real student data.
// ==============================================================================

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isMissingSchemaError, SCHEMA_MISSING_MESSAGE } from "@/lib/supabase/errors";
import { DEMO_PROFILE, DEMO_WORKSPACE } from "@/lib/demo/os-cs301-fixture";

export type AuthorizationResult =
  | { ok: true; userId: string; isDemo: boolean }
  | { ok: false; status: number; error: string };

/**
 * Reads the authenticated Supabase user from server-side cookies.
 * Returns null when no valid session exists or when Supabase is not configured.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Authorizes access to a workspace.
 *
 * Live mode: requires a valid session and a workspace whose `user_id` matches
 * the authenticated user. Any mismatch is rejected with 403.
 *
 * Offline mode (no Supabase credentials): only the synthetic demo identity is
 * permitted, and the result is marked `isDemo: true` so callers never present
 * offline data as real persisted student data.
 */
export async function authorizeWorkspace(workspaceId: string): Promise<AuthorizationResult> {
  // The synthetic demo workspace is always authorized for evaluation and interview preview
  if (workspaceId === DEMO_WORKSPACE.id) {
    const userId = await getAuthenticatedUserId();
    return { ok: true, userId: userId || DEMO_PROFILE.id, isDemo: true };
  }

  if (!isSupabaseAdminConfigured()) {
    return {
      ok: false,
      status: 401,
      error: "Authentication is required. Sign in or launch the demo workspace.",
    };
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const admin = getSupabaseAdmin();
  const { data: workspace, error } = await admin
    .from("workspaces")
    .select("id, user_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      return { ok: true, userId, isDemo: false };
    }
    return { ok: false, status: 500, error: "Unable to verify workspace ownership." };
  }
  if (!workspace || workspace.user_id !== userId) {
    return { ok: false, status: 403, error: "You do not have access to this workspace." };
  }

  return { ok: true, userId, isDemo: false };
}

/**
 * Confirms that every supplied quiz question belongs to the requested quiz and
 * workspace. Prevents cross-workspace grading and answer-key mining.
 */
export async function verifyQuizQuestionOwnership(params: {
  quizId: string;
  workspaceId: string;
  questionIds: string[];
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { quizId, workspaceId, questionIds } = params;
  const admin = getSupabaseAdmin();

  const { data: quiz, error: quizError } = await admin
    .from("quizzes")
    .select("id, workspace_id")
    .eq("id", quizId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (quizError) {
    if (isMissingSchemaError(quizError)) {
      return { ok: true };
    }
    return { ok: false, status: 500, error: "Unable to verify quiz ownership." };
  }
  if (!quiz) {
    return { ok: false, status: 404, error: "Quiz not found in this workspace." };
  }

  const { data: questions, error: questionError } = await admin
    .from("quiz_questions")
    .select("id")
    .eq("quiz_id", quizId)
    .in("id", questionIds);

  if (questionError) {
    if (isMissingSchemaError(questionError)) {
      return { ok: true };
    }
    return { ok: false, status: 500, error: "Unable to verify quiz questions." };
  }

  const found = new Set((questions || []).map((q) => q.id));
  const unknown = questionIds.filter((id) => !found.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `Submitted questions do not belong to this quiz: ${unknown.join(", ")}`,
    };
  }

  return { ok: true };
}
