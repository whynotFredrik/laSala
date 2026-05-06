import { NextResponse, type NextRequest } from "next/server"

import { sendEmail } from "@/lib/email/send"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LOW_THRESHOLD = 2

/**
 * Daily cron — for every active plan with `sessions_total - sessions_used <= 2`,
 * send the user a "you're running low" reminder.
 *
 * To avoid spamming the same member every day for the rest of their plan, we
 * check the `email_log` table for a `lowSessionsWarning` row in the past
 * 7 days and skip if one exists. (Cheap dedupe; replace with a dedicated
 * `notifications` table if it gets noisier.)
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
      "id, sessions_total, sessions_used, profiles(id, email, full_name), plan_tiers(name_ro)",
    )
    .eq("is_active", true)

  let sent = 0
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86400_000).toISOString()

  for (const plan of plans ?? []) {
    const remaining = plan.sessions_total - plan.sessions_used
    if (remaining > LOW_THRESHOLD || remaining < 0) continue
    if (!plan.profiles) continue

    const { data: recent } = await service
      .from("email_log")
      .select("id")
      .eq("user_id", plan.profiles.id)
      .eq("template", "lowSessionsWarning")
      .gte("created_at", sevenDaysAgoIso)
      .limit(1)
    if (recent && recent.length > 0) continue

    await sendEmail({
      to: plan.profiles.email,
      userId: plan.profiles.id,
      template: "lowSessionsWarning",
      props: {
        name: plan.profiles.full_name ?? plan.profiles.email,
        planName: plan.plan_tiers?.name_ro ?? "—",
        remaining,
      },
    })
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
