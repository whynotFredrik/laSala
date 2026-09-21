import { NextResponse, type NextRequest } from "next/server"

import { siteUrl } from "@/lib/constants"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import {
  remainingSessions,
  renewalDedupeKey,
  renewalReminderDue,
} from "@/lib/plans/rules"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Daily cron — "renew now" reminders so members keep their streak.
 *
 * Rule (studio): plans with 12+ sessions get the first nudge 3 sessions
 * before the end, 8-session plans 2 sessions before, and one more each
 * time the remaining count drops (see `renewalThreshold`). A member with a
 * pending request is left alone; an approved renewal merges into the plan
 * and lifts the count above the threshold by itself.
 *
 * "Once per remaining value, at most once a day" falls out of the
 * notifications dedupe key `renewal:<plan_id>:<remaining>` combined with
 * the daily schedule: cancelling and re-booking back to the same value
 * does not resend.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()

  const { data: plans } = await service
    .from("plans")
    .select(
      "id, user_id, tier_id, end_date, sessions_total, sessions_used, profiles!plans_user_id_fkey(id, email, full_name), plan_tiers(name_ro)",
    )
    .eq("status", "active")

  const due = (plans ?? []).filter((p) => p.profiles && renewalReminderDue(p))
  if (due.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  const userIds = due.map((p) => p.user_id)
  const { data: pending } = await service
    .from("plan_requests")
    .select("user_id")
    .in("user_id", userIds)
    .eq("status", "pending")
  const alreadyRenewing = new Set((pending ?? []).map((r) => r.user_id))

  const copy = notificationCopy()
  let sent = 0
  let skipped = 0

  for (const plan of due) {
    if (!plan.profiles || alreadyRenewing.has(plan.user_id)) continue
    const remaining = remainingSessions(plan)
    const planName = plan.plan_tiers?.name_ro ?? "—"
    const result = await notify({
      userId: plan.user_id,
      type: "renewal_reminder",
      title: copy("renewalReminderTitle", { remaining }),
      body: copy("renewalReminderBody"),
      data: { plan_id: plan.id, tier_id: plan.tier_id, remaining },
      dedupeKey: renewalDedupeKey(plan.id, remaining),
      email: {
        to: plan.profiles.email,
        template: "renewalReminder",
        props: {
          name: plan.profiles.full_name ?? plan.profiles.email,
          planName,
          remaining,
          renewUrl: `${siteUrl()}/plans?tier=${plan.tier_id}`,
        },
      },
    })
    if (result.status === "sent") sent++
    else skipped++
  }

  return NextResponse.json({ ok: true, sent, skipped })
}
