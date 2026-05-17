import { NextResponse, type NextRequest } from "next/server"

import { generateNextWeekSessionsCron } from "@/app/admin/sessions/actions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Weekly cron — generates the next week's sessions from the schedule
 * template. Scheduled to run every Sunday at 00:05 Europe/Bucharest
 * (which is 21:05 UTC on Saturday in winter, 22:05 in summer — we use
 * 22:05 UTC and accept the 1-hour DST drift; sessions still unlock at
 * the right local moment because unlock_at is computed in Bucharest TZ).
 *
 * Idempotent — re-running just skips already-existing rows.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await generateNextWeekSessionsCron()
  return NextResponse.json(result)
}
