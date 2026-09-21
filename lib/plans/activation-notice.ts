import "server-only"

import { format, subDays } from "date-fns"
import { ro } from "date-fns/locale"

import { notificationCopy, notify } from "@/lib/notifications/notify"
import { planActivatedDedupeKey } from "@/lib/plans/rules"
import type { createServiceClient } from "@/lib/supabase/service"

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Tell members whose plan became active recently. Queued plans can flip
 * to active inside `book_session` / `book_session_for` (no application
 * hook), so instead of chasing every path we look at `activated_at` and
 * rely on the per-plan dedupe key: the approval action sends the same
 * key for immediately-activated plans, so nobody gets it twice.
 */
export async function notifyRecentActivations(
  service: ServiceClient,
  now: Date = new Date(),
): Promise<number> {
  const since = subDays(now, 7).toISOString()
  const { data: plans } = await service
    .from("plans")
    .select(
      "id, user_id, sessions_total, end_date, activated_at, plan_tiers(name_ro), profiles!plans_user_id_fkey(email, full_name)",
    )
    .eq("status", "active")
    .gte("activated_at", since)

  const copy = notificationCopy()
  let sent = 0
  for (const plan of plans ?? []) {
    if (!plan.profiles) continue
    const planName = plan.plan_tiers?.name_ro ?? "—"
    const endDate = format(new Date(plan.end_date), "d MMMM yyyy", {
      locale: ro,
    })
    const result = await notify({
      userId: plan.user_id,
      type: "plan_activated",
      title: copy("planActivatedTitle", { planName }),
      body: copy("planActivatedBody", {
        sessionsTotal: plan.sessions_total,
        endDate,
      }),
      data: { plan_id: plan.id },
      dedupeKey: planActivatedDedupeKey(plan.id),
      email: {
        to: plan.profiles.email,
        template: "planActivated",
        props: {
          name: plan.profiles.full_name ?? plan.profiles.email,
          planName,
          sessionsTotal: plan.sessions_total,
          endDate,
        },
      },
    })
    if (result.status === "sent") sent++
  }
  return sent
}
