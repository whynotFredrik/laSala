"use server"

import { addDays, formatISO, parseISO } from "date-fns"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { formatStudio } from "@/lib/booking/format"
import { bookPinsForSessions, touchedSessionIds } from "@/lib/booking/recurring"
import { nextWeekDue, studioDateISO, studioWeekStart } from "@/lib/booking/rules"
import { scheduleCalendarSync } from "@/lib/google/schedule-sync"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import {
  cancelledCountByUser,
  closeResultSchema,
  closureNotices,
  type CloseResult,
  type PlanExtension,
  type ReopenResult,
  reopenResultSchema,
} from "@/lib/sessions/closure-result"
import { ensureSessionsForWeek } from "@/lib/sessions/ensure-week"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type ClosureState =
  | { status: "idle" }
  | { status: "ok"; days: number; cancelled: number; extended: number }
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

/** A plan date (YYYY-MM-DD) as "3 decembrie 2026". */
function formatPlanDate(day: string): string {
  return formatStudio(`${day}T12:00:00Z`, "d MMMM yyyy")
}

/**
 * Close the studio on the chosen dates. `admin_close_studio_days`
 * (migrations 0036, 0037) re-checks the admin role, records the closures,
 * cancels every booking on those dates through `cancel_booking`, so each
 * member gets the session back, and extends every active plan running on
 * a newly closed day by one day per day. Each affected member is then
 * notified, and the days' sessions are dropped from Google Calendar.
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

  const { data, error } = await supabase.rpc("admin_close_studio_days", {
    p_dates: uniqueDates,
    p_reason: reason,
  })
  if (error) return { status: "error", message: closureErrorKey(error.message) }
  // The closure is committed; a malformed result only skips the notices.
  const result = closeResultSchema.safeParse(data)

  const service = createServiceClient()
  // Sent after the response: a holiday can notify every active member.
  if (result.success) {
    const closure = result.data
    after(() => notifyClosure(service, closure, reason))
  }

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
    cancelled: result.success ? result.data.cancelled.length : 0,
    extended: result.success ? result.data.extended.length : 0,
  }
}

async function notifyClosure(
  service: ReturnType<typeof createServiceClient>,
  result: CloseResult,
  reason: string | null,
) {
  const notices = closureNotices(result)
  if (notices.length === 0) return

  const userIds = Array.from(
    new Set(
      notices.map((n) =>
        n.kind === "cancelled" ? n.booking.user_id : n.extension.user_id,
      ),
    ),
  )
  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    result.cancelled.length === 0
      ? Promise.resolve({ data: [] as { id: string; start_at: string }[] })
      : service
          .from("sessions")
          .select("id, start_at")
          .in(
            "id",
            result.cancelled.map((b) => b.session_id),
          ),
    service.from("profiles").select("id, full_name, email").in("id", userIds),
  ])
  const startById = new Map((sessions ?? []).map((s) => [s.id, s.start_at]))
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const copy = notificationCopy()

  const extensionText = (e: PlanExtension) =>
    copy("studioClosedExtension", {
      days: e.days,
      endDate: formatPlanDate(e.end_date),
    })

  // One at a time, like the weekly summary: a holiday can reach every
  // active member, and parallel sends would trip the email rate limit.
  for (const n of notices) {
    if (n.kind === "cancelled") {
      const b = n.booking
      const startAt = startById.get(b.session_id)
      const profile = profileById.get(b.user_id)
      if (!startAt || !profile) continue
      const date = formatStudio(startAt, "EEEE, d MMMM")
      const time = formatStudio(startAt, "HH:mm")
      const body = copy("studioClosedBody", {
        date,
        time,
        reason: reason ?? "none",
      })
      await notify({
        userId: b.user_id,
        type: "studio_closed",
        title: copy("studioClosedTitle", { date }),
        body: n.extension ? `${body} ${extensionText(n.extension)}` : body,
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
            extension: n.extension
              ? {
                  days: n.extension.days,
                  endDate: formatPlanDate(n.extension.end_date),
                }
              : null,
          },
        },
      })
      continue
    }

    const e = n.extension
    const profile = profileById.get(e.user_id)
    if (!profile) continue
    const dates = e.dates
      .map((d) => formatStudio(`${d}T12:00:00Z`, "EEEE, d MMMM"))
      .join(", ")
    const endDate = formatPlanDate(e.end_date)
    await notify({
      userId: e.user_id,
      type: "plan_extended",
      title: copy("planExtendedTitle", { days: e.days }),
      body: copy("planExtendedBody", {
        dates,
        reason: reason ?? "none",
        endDate,
      }),
      data: { plan_id: e.plan_id, dates: e.dates },
      dedupeKey: `plan_extended:${e.plan_id}:${e.dates.join(",")}`,
      email: {
        to: profile.email,
        template: "planExtendedClosure",
        props: {
          name: profile.full_name ?? profile.email,
          dates,
          reason,
          days: e.days,
          endDate,
        },
      },
    })
  }
}

const reopenSchema = z.object({ date: DAY })

/**
 * Reopen a closed day. Bookings cancelled by the closure stay cancelled.
 * If the day is today or later, the plans it extended are shortened by one
 * day again (migration 0037) and their members are told in-app.
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
  const { data, error } = await supabase.rpc("admin_reopen_studio_day", {
    p_date: parsed.data.date,
  })
  if (error) return { status: "error", message: closureErrorKey(error.message) }
  const result = reopenResultSchema.safeParse(data)
  if (result.success) await notifyReopen(result.data, parsed.data.date)

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
  return {
    status: "ok",
    days: 1,
    cancelled: result.success ? result.data.cancelled.length : 0,
    extended: 0,
  }
}

/** In-app notice to each member whose closure extension was taken back. */
async function notifyReopen(result: ReopenResult, day: string) {
  if (result.shortened.length === 0) return
  const copy = notificationCopy()
  const cancelledByUser = cancelledCountByUser(result.cancelled)
  const date = formatStudio(`${day}T12:00:00Z`, "EEEE, d MMMM")

  await Promise.all(
    result.shortened.map((s) =>
      notify({
        userId: s.user_id,
        type: "plan_extension_reverted",
        title: copy("planExtensionRevertedTitle", { date }),
        body: copy("planExtensionRevertedBody", {
          date,
          endDate: formatPlanDate(s.end_date),
          cancelled: cancelledByUser.get(s.user_id) ?? 0,
        }),
        data: { plan_id: s.plan_id, reopened: day },
      }),
    ),
  )
}
