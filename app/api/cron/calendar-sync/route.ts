import { NextResponse, type NextRequest } from "next/server"

import { reconcileCalendar } from "@/lib/google/sync"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Daily cron — reconciles the studio's Google Calendar with the sessions
 * table over a window of yesterday .. +21 days: pushes changed sessions,
 * removes events for deleted sessions, and sweeps stray tagged events.
 *
 * Inline syncs after each booking keep the calendar fresh between runs;
 * this is the safety net. No-op (configured: false) when the Google env
 * vars are not set.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const result = await reconcileCalendar()
  return NextResponse.json(result)
}
