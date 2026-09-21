import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>
type PlanRow = Database["public"]["Tables"]["plans"]["Row"]
type TierRow = Database["public"]["Tables"]["plan_tiers"]["Row"]

export const PLAN_WITH_TIER =
  "*, plan_tiers(name_ro, name_en, category, duration_months, sessions_per_month)" as const

export type PlanWithTier = PlanRow & {
  plan_tiers: Pick<
    TierRow,
    "name_ro" | "name_en" | "category" | "duration_months" | "sessions_per_month"
  > | null
}

/**
 * The member's current plan (at most one thanks to
 * `plans_one_active_per_user`). Works with either the user-scoped client
 * (RLS: own rows / admin) or the service client.
 */
export async function getActivePlan(
  client: Client,
  userId: string,
): Promise<PlanWithTier | null> {
  const { data } = await client
    .from("plans")
    .select(PLAN_WITH_TIER)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  return (data as PlanWithTier | null) ?? null
}

/**
 * The plan waiting to take over when the current one ends (at most one,
 * `plans_one_queued_per_user`). Its dates are provisional until activation.
 */
export async function getQueuedPlan(
  client: Client,
  userId: string,
): Promise<PlanWithTier | null> {
  const { data } = await client
    .from("plans")
    .select(PLAN_WITH_TIER)
    .eq("user_id", userId)
    .eq("status", "queued")
    .maybeSingle()
  return (data as PlanWithTier | null) ?? null
}

export async function getMemberPlans(
  client: Client,
  userId: string,
): Promise<{ active: PlanWithTier | null; queued: PlanWithTier | null }> {
  const [active, queued] = await Promise.all([
    getActivePlan(client, userId),
    getQueuedPlan(client, userId),
  ])
  return { active, queued }
}
