import { revalidatePath } from "next/cache"
import { NextResponse, type NextRequest } from "next/server"
import { addDays } from "date-fns"

import {
  bookPinsForSessions,
  touchedSessionIds,
  type PinOutcome,
} from "@/lib/booking/recurring"
import { nextWeekDue, studioWeekStart } from "@/lib/booking/rules"
import { scheduleCalendarSync } from "@/lib/google/schedule-sync"
import { sendWeeklySummaries } from "@/lib/notifications/send-weekly-summary"
import { notifyRecentActivations } from "@/lib/plans/activation-notice"
import { ensureSessionsForWeek } from "@/lib/sessions/ensure-week"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
// Full template loop + one RPC per pin + calendar sync via `after()`.
export const maxDuration = 60

/**
 * Daily cron (04:00 UTC = 06:00/07:00 Bucharest). Replaces the manual
 * "generate week" buttons and the Sunday-only generator:
 *
 * 1. Activate queued plans whose predecessor expired by date (exhaustion
 *    is handled lazily inside the booking functions).
 * 2. Make sure the current studio week's sessions exist; from Saturday
 *    onward also next week's (one day before the Sunday-midnight unlock).
 * 3. Book every active recurring pin against those sessions. Idempotent:
 *    members already booked are reported as `existing`, refusals (no plan,
 *    full session, ...) are reported with a reason and retried tomorrow.
 * 4. Notify members whose plan was activated since the last run (queued →
 *    active, whichever path flipped it) — deduped per plan.
 * 5. From Saturday: send each recurring member their "sessions next week"
 *    summary (deduped per week, so Sunday's run is a no-op repeat).
 * 6. Push touched sessions to Google Calendar.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()
  const now = new Date()

  try {
    const { data: activated, error: activateErr } = await service.rpc(
      "activate_due_queued_plans",
    )
    if (activateErr) {
      throw new Error(`activate_due_queued_plans: ${activateErr.message}`)
    }

    const weeks = [await ensureSessionsForWeek(service, now)]
    if (nextWeekDue(now)) {
      weeks.push(await ensureSessionsForWeek(service, addDays(now, 7)))
    }

    const sessionIds = weeks.flatMap((w) => w.sessionIds)
    const outcomes: PinOutcome[] = await bookPinsForSessions(
      service,
      sessionIds,
      now,
    )

    const activationNotices = await notifyRecentActivations(service, now)

    const weeklySummary = nextWeekDue(now)
      ? await sendWeeklySummaries(
          service,
          studioWeekStart(addDays(now, 7)),
          outcomes,
        )
      : null

    scheduleCalendarSync(touchedSessionIds(outcomes))
    revalidatePath("/admin/sessions")
    revalidatePath("/book")
    revalidatePath("/home")

    return NextResponse.json({
      ok: true,
      activatedByDate: (activated ?? []).length,
      activationNotices,
      weeklySummary,
      weeks: weeks.map((w) => ({
        weekStart: w.weekStart,
        created: w.created,
        skipped: w.skipped,
      })),
      pins: summarise(outcomes),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

function summarise(outcomes: PinOutcome[]) {
  const counts = { booked: 0, grace: 0, existing: 0, skipped: 0 }
  for (const o of outcomes) counts[o.status]++
  return {
    ...counts,
    skips: outcomes
      .filter((o) => o.status === "skipped")
      .map((o) => ({
        userId: o.userId,
        sessionId: o.sessionId,
        reason: o.reason,
        message: o.message,
      })),
  }
}
