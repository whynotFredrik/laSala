import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

type Client = SupabaseClient<Database>
type RequestRow = Database["public"]["Tables"]["plan_requests"]["Row"]
type TierRow = Database["public"]["Tables"]["plan_tiers"]["Row"]

export type PendingRequest = Pick<
  RequestRow,
  "id" | "created_at" | "tier_id" | "preferred_payment_method"
> & {
  plan_tiers: Pick<
    TierRow,
    | "name_ro"
    | "category"
    | "sessions_per_month"
    | "duration_months"
    | "price_male_ron"
    | "price_female_ron"
  > | null
}

/**
 * The member's pending plan request with its tier (at most one, by the
 * partial unique index on `plan_requests`). `plan_tiers` is null when the
 * tier has since been deactivated (RLS hides inactive tiers from members).
 */
export async function getPendingRequest(
  client: Client,
  userId: string,
): Promise<PendingRequest | null> {
  const { data } = await client
    .from("plan_requests")
    .select(
      "id, created_at, tier_id, preferred_payment_method, plan_tiers(name_ro, category, sessions_per_month, duration_months, price_male_ron, price_female_ron)",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle()
  return data ?? null
}
