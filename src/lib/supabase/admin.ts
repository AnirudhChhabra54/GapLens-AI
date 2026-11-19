// ==============================================================================
// GapLens AI — Supabase Administrative Client (Service Role)
// Used exclusively by backend ingestion workers, queue consumers, and cron tasks
// NEVER import or invoke this module on client-side bundles!
// ==============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClientInstance: SupabaseClient<Database> | null = null;

/**
 * Checks whether valid Supabase admin credentials exist in the runtime environment.
 */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes("your-service-role-key")
  );
}

/**
 * Retrieves the Supabase Service-Role Admin client.
 * Guards against missing service role key and warns when running in offline/unconfigured mode.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[Supabase Admin] WARNING: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing. " +
      "Database operations requiring elevated privileges will run in mock/offline mode."
    );
  }

  adminClientInstance = createClient<Database>(
    supabaseUrl || "https://placeholder-project.supabase.co",
    serviceRoleKey || "placeholder-service-role-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClientInstance;
}

export const supabaseAdmin = getSupabaseAdmin();
