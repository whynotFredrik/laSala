"use server"

import { addDays, formatISO, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { formatStudio } from "@/lib/booking/format"
import { bookPinsForSessions, touchedSessionIds } from "@/lib/booking/recurring"
import { nextWeekDue, studioDateISO, studioWeekStart } from "@/lib/booking/rules"
import { scheduleCalendarSync } from "@/lib/google/schedule-sync"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import { ensureSessionsForWeek } from "@/lib/sessions/ensure-week"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type ClosureState =
  | { status: "idle" }
  | { status: "ok"; days: number; cancelled: number }
  | { status: "error"; message: string }

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const closeSchema = z.object({
  dates: z.array(DAY).min(1).max(60),
  reason: z.string().trim().max(200).optional(),
})

/** Maps Postgres exceptions from the closure functions to `adminClosures.errors.*`. */
function closureErrorKey(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("in the past")) return "date_in_past"
  if (m.includes("admin only")) return "forbidden"
  return "unknown"
}

function revalidateClosurePages() {
  revalidatePath("/admin/closures")
  revalidatePath("/admin/sessions")
  revalidatePath("/admin")
  revalidatePath("/book")
  revalidatePath("/home")
}

/**
 * Close the studio on the chosen dates. `admin_close_studio_days`
 * (migration 0036) re-checks the admin role, records the closures and
 * cancels every booking on those dates through `cancel_booking`, so each
 * member gets the session back. Each affected member is then notified,
 * and the days' sessions are dropped from Google Calendar.
 */
export async function closeDaysAction(
  _prev: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  let dates: unknown
  try {
    dates = JSON.parse(String(formData.get("dates") ?? "[]"))
  } catch {
    return { status: "error", message: "invalid_input" }
  }
  const parsed = closeSchema.safeParse({
    dates,
    reason: formData.get("reason") ?? undefined,
  })
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  // Regular client so auth.uid() inside the RPC = admin and is_admin() holds.
  const supabase = await createClient()
  const reason = parsed.data.reason || null
  const uniqueDates = Array.from(new Set(parsed.data.dates)).sort()

  const { data: cancelled, error } = await supabase.rpc(
    "admin_close_studio_days",
    { p_dates: uniqueDates, p_reason: reason },
  )
  if (error) return { status: "error", message: closureErrorKey(error.message) }

  const service = createServiceClient()
  await notifyCancelledMembers(service, cancelled ?? [], reason)

  // Every session on those days leaves the calendar (sync treats a closed
  // day's sessions as gone), not only the ones that had bookings.
  const { data: daySessions } = await service
    .from("sessions")
    .select("id")
    .in("session_date", uniqueDates)
  scheduleCalendarSync((daySessions ?? []).map((s) => s.id))

  revalidateClosurePages()
  return {
    status: "ok",
    days: uniqueDates.length,
    cancelled: (cancelled ?? []).length,
  }
}

async function notifyCancelledMembers(
  service: ReturnType<typeof createServiceClient>,
  cancelled: { id: string; user_id: string; session_id: string }[],
  reason: string | null,
) {
  if (cancelled.length === 0) return

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    service
      .from("sessions")
      .select("id, start_at")
      .in(
        "id",
        cancelled.map((b) => b.session_id),
      ),
    service
      .from("profiles")
      .select("id, full_name, email")
      .in(
        "id",
        cancelled.map((b) => b.user_id),
      ),
  ])
  const startById = new Map((sessions ?? []).map((s) => [s.id, s.start_at]))
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const copy = notificationCopy()

  await Promise.all(
    cancelled.map(async (b) => {
      const startAt = startById.get(b.session_id)
      const profile = profileById.get(b.user_id)
      if (!startAt || !profile) return
      const date = formatStudio(startAt, "EEEE, d MMMM")
      const time = formatStudio(startAt, "HH:mm")
      await notify({
        userId: b.user_id,
        type: "studio_closed",
        title: copy("studioClosedTitle", { date }),
        body: copy("studioClosedBody", {
          date,
          time,
          reason: reason ?? "none",
        }),
        data: { booking_id: b.id, session_id: b.session_id },
        dedupeKey: `studio_closed:${b.id}`,
        email: {
          to: profile.email,
          template: "studioClosure",
          props: {
            name: profile.full_name ?? profile.email,
            date,
            time,
            reason,
          },
        },
      })
    }),
  )
}

const reopenSchema = z.object({ date: DAY })

/**
 * Reopen a closed day. Bookings cancelled by the closure stay cancelled.
 * If the day falls in a week the daily sync already generates (this week,
 * or next week from Saturday), its sessions and recurring pins are
 * created now instead of at the next morning's run.
 */
export async function reopenDayAction(
  _prev: ClosureState,
  formData: FormData,
): Promise<ClosureState> {
  const parsed = reopenSchema.safeParse({ date: formData.get("date") })
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_reopen_studio_day", {
    p_date: parsed.data.date,
  })
  if (error) return { status: "error", message: closureErrorKey(error.message) }

  const now = new Date()
  const weekOf = (d: Date) =>
    formatISO(studioWeekStart(d), { representation: "date" })
  const dayWeek = weekOf(parseISO(`${parsed.data.date}T12:00:00Z`))
  const syncedWeeks = [weekOf(now)]
  if (nextWeekDue(now)) syncedWeeks.push(weekOf(addDays(now, 7)))

  if (parsed.data.date >= studioDateISO(now) && syncedWeeks.includes(dayWeek)) {
    const service = createServiceClient()
    const week = await ensureSessionsForWeek(
      service,
      parseISO(`${parsed.data.date}T12:00:00Z`),
    )
    const { data: daySessions } = await service
      .from("sessions")
      .select("id")
      .eq("session_date", parsed.data.date)
    const dayIds = new Set((daySessions ?? []).map((s) => s.id))
    const outcomes = await bookPinsForSessions(
      service,
      week.sessionIds.filter((id) => dayIds.has(id)),
      now,
    )
    scheduleCalendarSync([...dayIds, ...touchedSessionIds(outcomes)])
  }

  revalidateClosurePages()
  return { status: "ok", days: 1, cancelled: 0 }
}
