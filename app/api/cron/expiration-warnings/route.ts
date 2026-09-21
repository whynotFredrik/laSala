import { NextResponse, type NextRequest } from "next/server"
import { addDays, format } from "date-fns"
import { ro } from "date-fns/locale"

import { formatStudio } from "@/lib/booking/format"
import { studioNow } from "@/lib/booking/rules"
import { notifyAdmins } from "@/lib/notifications/admins"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import { expiryDedupeKey } from "@/lib/plans/rules"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TARGETS = [7, 3, 1] as const

/**
 * Daily cron — for every active plan that expires in exactly 7, 3, or 1
 * days from today (studio calendar, Europe/Bucharest), notify the member
 * in-app + by email. Admins get one digest per day listing everyone who
 * was warned (deduped per studio date). Members with a queued plan are skipped: their
 * renewal is already sorted.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel sends it).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()
  const nowLocal = studioNow()
  const copy = notificationCopy()
  let sent = 0
  const digest: string[] = []

  for (const days of TARGETS) {
    const targetIso = formatStudio(addDays(nowLocal, days), "yyyy-MM-dd")

    const { data: plans } = await service
      .from("plans")
      .select(
        "id, user_id, tier_id, end_date, sessions_total, sessions_used, profiles!plans_user_id_fkey(id, email, full_name), plan_tiers(name_ro)",
      )
      .eq("status", "active")
      .eq("end_date", targetIso)
    if (!plans || plans.length === 0) continue

    const { data: queued } = await service
      .from("plans")
      .select("user_id")
      .in(
        "user_id",
        plans.map((p) => p.user_id),
      )
      .eq("status", "queued")
    const hasQueued = new Set((queued ?? []).map((q) => q.user_id))

    for (const plan of plans) {
      if (!plan.profiles || hasQueued.has(plan.user_id)) continue
      const planName = plan.plan_tiers?.name_ro ?? "—"
      const endDate = format(new Date(plan.end_date), "d MMMM yyyy", {
        locale: ro,
      })
      const result = await notify({
        userId: plan.user_id,
        type: "expiration_warning",
        title: copy("expirationTitle", { days }),
        body: copy("expirationBody", { planName, endDate }),
        data: { plan_id: plan.id, tier_id: plan.tier_id, days },
        dedupeKey: expiryDedupeKey(plan.id, days),
        email: {
          to: plan.profiles.email,
          template: "expirationWarning",
          props: {
            name: plan.profiles.full_name ?? plan.profiles.email,
            planName,
            days,
            endDate,
          },
        },
      })
      if (result.status === "sent") sent++
      digest.push(
        copy("adminExpiryLine", {
          name: plan.profiles.full_name ?? plan.profiles.email,
          planName,
          endDate,
          days,
          remaining: Math.max(plan.sessions_total - plan.sessions_used, 0),
        }),
      )
    }
  }

  let admins = 0
  if (digest.length > 0) {
    const today = formatStudio(nowLocal, "yyyy-MM-dd")
    const dateLabel = formatStudio(nowLocal, "d MMMM yyyy")
    const result = await notifyAdmins({
      type: "admin_expiry_digest",
      title: copy("adminExpiryTitle", { count: digest.length }),
      body: [copy("adminExpiryIntro"), ...digest.map((l) => `• ${l}`)].join(
        "\n",
      ),
      data: { date: today, count: digest.length },
      dedupeKey: `admin_expiry:${today}`,
      email: {
        template: "adminExpiryDigest",
        props: { date: dateLabel, lines: digest },
      },
    })
    admins = result.notified
  }

  return NextResponse.json({ ok: true, sent, admins })
}
