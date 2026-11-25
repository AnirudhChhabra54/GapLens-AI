// ==============================================================================
// GapLens AI — System Health & Readiness Endpoint
// GET /api/health
// Reports Supabase schema initialization, storage bucket, and AI provider status.
// ==============================================================================

import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { isGroqLive, getGroqModel } from "@/lib/ai/groq";
import { isJinaLive, getJinaModel } from "@/lib/ai/jina";
import { isGeminiLive } from "@/lib/ai/gemini";

export async function GET() {
  const supabaseConfigured = isSupabaseAdminConfigured();
  let schemaInitialized = false;
  let documentsBucketReady = false;
  let dbError: string | null = null;

  if (supabaseConfigured) {
    try {
      const admin = getSupabaseAdmin();
      const { error } = await admin.from("workspaces").select("id").limit(1);
      if (!error) {
        schemaInitialized = true;
      } else if (!isMissingSchemaError(error)) {
        dbError = error.message;
      }

      const { data: buckets } = await admin.storage.listBuckets();
      documentsBucketReady = Boolean(buckets?.some((b) => b.name === "documents"));
    } catch (err: any) {
      dbError = err?.message || String(err);
    }
  }

  const groqLive = isGroqLive();
  const jinaLive = isJinaLive();
  const geminiLive = isGeminiLive();

  return NextResponse.json({
    ok: true,
    status: !supabaseConfigured || !schemaInitialized || !groqLive ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    database: {
      configured: supabaseConfigured,
      schemaInitialized,
      error: dbError,
    },
    storage: {
      documentsBucketReady,
    },
    ai: {
      llmProvider: groqLive ? "groq" : geminiLive ? "gemini" : "offline_mock",
      llmModel: groqLive ? getGroqModel() : geminiLive ? "gemini-3.8-flash" : "deterministic-mock",
      embeddingProvider: jinaLive ? "jina" : geminiLive ? "gemini" : "offline_mock",
      embeddingModel: jinaLive
        ? getJinaModel()
        : geminiLive
        ? "gemini-embedding-001"
        : "deterministic-local-768d",
    },
  });
}
