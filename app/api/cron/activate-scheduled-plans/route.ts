import { NextResponse, type NextRequest } from "next/server"

import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Daily cron — fires shortly after midnight Bucharest. Activates queued
 * renewals (`plans.is_scheduled`) whose start_date has arrived: the member
 * paid early to keep their streak, and the new plan takes over the day after
 * the old one ends. All logic lives in the Postgres function
 * `activate_due_scheduled_plans` (see 0018_renewal_streak.sql).
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
  const { data: activated, error } = await service.rpc(
    "activate_due_scheduled_plans",
  )
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, activated })
}
