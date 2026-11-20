// ==============================================================================
// GapLens AI — Supabase Error Normalization Helpers
// Detects infrastructure/setup failures (missing schema, stale PostgREST cache)
// so API routes can return actionable messages instead of raw Postgres errors.
// ==============================================================================

export const SCHEMA_MISSING_MESSAGE =
  "The Supabase database schema is not initialized. Apply the SQL files in " +
  "supabase/migrations/ (and optionally supabase/seed/) in the Supabase SQL " +
  "editor, then retry. The bundled 1-click Demo workspace does not require " +
  "these tables.";

interface SupabaseLikeError {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

function errorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  const e = error as SupabaseLikeError;
  return [e.message, e.details, e.hint].filter(Boolean).join(" ");
}

/**
 * True when PostgREST reports a missing relation/column or a stale schema cache.
 * This is a deployment/setup problem, not a request problem.
 */
export function isMissingSchemaError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  if (!text) return false;

  return (
    text.includes("could not find the table") ||
    text.includes("could not find the relation") ||
    text.includes("could not find the function") ||
    text.includes("relation \"public.") ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("undefined table") ||
    (typeof error === "object" &&
      error !== null &&
      ["42P01", "42P02", "3F000", "PGRST202", "PGRST204", "PGRST205"].includes(
        (error as SupabaseLikeError).code || ""
      ))
  );
}

export function schemaMissingPayload(extra?: Record<string, unknown>) {
  return {
    error: SCHEMA_MISSING_MESSAGE,
    code: "SCHEMA_MISSING" as const,
    ...extra,
  };
}
