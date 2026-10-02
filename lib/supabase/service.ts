import "server-only"

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

/**
 * Service-role Supabase client. Bypasses RLS — never call this from a Client
 * Component, never expose its responses unfiltered to the browser, and only
 * use it for genuinely privileged work (cron, webhooks, admin actions where
 * you've already verified the caller is an admin).
 *
 * The `server-only` import causes the build to fail if this module is
 * accidentally imported into client code.
 *
 * Pass `actorId` (the verified admin's user id) when the client writes on
 * an admin's behalf: it is sent as `x-actor-id`, which the audit triggers
 * (migration 0031) record as who made the change. Without it, service-role
 * writes show up as automatic (cron / sync).
 */
export function createServiceClient(opts: { actorId?: string } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the service client.",
    )
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: opts.actorId
      ? { headers: { "x-actor-id": opts.actorId } }
      : undefined,
  })
}
