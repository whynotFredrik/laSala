import { NextResponse, type NextRequest } from "next/server"
import { format } from "date-fns"
import { ro } from "date-fns/locale"

import { sendEmail } from "@/lib/email/send"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Daily cron — fires at 09:00 Bucharest. For every active plan that expires
 * in exactly 7, 3, or 1 days from today, send the user a warning email.
 *
 * Auth: the request must include `Authorization: Bearer ${CRON_SECRET}`
 * (Vercel cron sends this automatically when CRON_SECRET is set in env).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()
  const today = new Date()
  const targets = [7, 3, 1]
  let sent = 0

  for (const days of targets) {
    const target = new Date(today)
    target.setDate(target.getDate() + days)
    const targetIso = target.toISOString().slice(0, 10)

    const { data: plans } = await service
      .from("plans")
      .select(
        "id, end_date, sessions_total, sessions_used, profiles(id, email, full_name), plan_tiers(name_ro)",
      )
      .eq("is_active", true)
      .eq("end_date", targetIso)

    for (const plan of plans ?? []) {
      if (!plan.profiles) continue
      await sendEmail({
        to: plan.profiles.email,
        userId: plan.profiles.id,
        template: "expirationWarning",
        props: {
          name: plan.profiles.full_name ?? plan.profiles.email,
          planName: plan.plan_tiers?.name_ro ?? "—",
          days,
          endDate: format(new Date(plan.end_date), "d MMMM yyyy", {
            locale: ro,
          }),
        },
      })
      sent++
    }
  }

  return NextResponse.json({ ok: true, sent })
}
