#!/usr/bin/env node
// ==============================================================================
// GapLens AI — Provision the synthetic demo Supabase Auth user
// Requires server-only credentials. Never expose these values to the client.
// Usage: pnpm demo:provision-auth
// ==============================================================================

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.DEMO_USER_EMAIL || "demo@gapfinder.ai";
const password = process.env.DEMO_USER_PASSWORD || "GapFinder2026!";

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Refusing to provision the demo user."
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser() {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < 200) return null;
    page += 1;
  }
  return null;
}

try {
  const existing = await findUser();
  if (existing) {
    console.log(`Demo auth user already exists: ${existing.id} (${email})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Alex Chen (Demo Student)", is_demo: true },
    });
    if (error) throw error;
    console.log(`Created demo auth user: ${data.user.id} (${email})`);
  }

  console.log("");
  console.log("Next: apply migrations, then run the seed with psql:");
  console.log("  psql \"$DATABASE_URL\" -f supabase/seed/os_cs301_seed.sql");
  console.log("");
  console.log("The seed resolves the auth user ID from auth.users by email.");
} catch (error) {
  console.error("Failed to provision demo auth user:", error.message || error);
  process.exit(1);
}
