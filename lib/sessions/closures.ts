import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

/**
 * Studio dates (YYYY-MM-DD, Europe/Bucharest) on which the studio is
 * closed, mapped to the admin's optional reason (migration 0036).
 *
 * Sessions are not generated on a closed date and the bookings trigger
 * refuses any booking there, but a day closed after its sessions were
 * generated keeps those rows — readers that list sessions use this to
 * hide them. Works with the user, browser or service client: every
 * signed-in user may read `studio_closures`.
 */
export async function loadClosedDates(
  client: SupabaseClient<Database>,
  from: string,
  to: string,
): Promise<Map<string, string | null>> {
  const { data, error } = await client
    .from("studio_closures")
    .select("closed_on, reason")
    .gte("closed_on", from)
    .lte("closed_on", to)
  if (error) throw new Error(`closures_load_failed: ${error.message}`)
  return new Map((data ?? []).map((c) => [c.closed_on, c.reason]))
}
