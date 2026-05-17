"use server"

import { revalidatePath } from "next/cache"
import { addDays, formatISO, startOfDay, getDay } from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"

import { requireAdmin } from "@/lib/auth/get-user"
import { STUDIO_TZ, unlockAtFor } from "@/lib/booking/rules"
import { createServiceClient } from "@/lib/supabase/service"

type ScheduleSlot = {
  id: string
  day_of_week: number
  start_hour: number
  start_minute: number
  duration_min: number
  capacity: number
  is_enabled: boolean
  class_id: string | null
  trainer: "Eugen" | "Marina" | "Ana" | null
}

/**
 * Returns the studio-local Monday of the ISO week containing `anchor`.
 * Our schedule template uses 0=Mon ... 6=Sun.
 */
function mondayOf(anchor: Date) {
  const local = toZonedTime(anchor, STUDIO_TZ)
  const day = getDay(local) // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 0 ? -6 : 1 - day // shift to Monday
  return startOfDay(addDays(local, offset))
}

export type GenerateSessionsResult =
  | {
      status: "ok"
      created: number
      skipped: number
      recurringBooked: number
      recurringSkipped: number
    }
  | { status: "error"; message: string }

/**
 * Core generator. Reads the schedule template and creates `sessions` rows
 * for the week containing `anchor` (Mon..Sun in studio local time).
 * Idempotent — re-running just bumps `skipped` for already-existing
 * (date, time, trainer) tuples.
 *
 * After each session is created, every member with an active recurring
 * pin pointing at that slot's template is auto-booked via the
 * `book_session_for` Postgres function. Auto-bookings that fail (no
 * active plan, plan expires before session, sessions exhausted, etc.) are
 * counted into `recurringSkipped` so the admin can see the result.
 */
async function generateForWeekContaining(
  anchor: Date,
): Promise<GenerateSessionsResult> {
  const service = createServiceClient()

  const { data: template, error: tplErr } = await service
    .from("schedule_template")
    .select(
      "id, day_of_week, start_hour, start_minute, duration_min, capacity, is_enabled, class_id, trainer",
    )
    .eq("is_enabled", true)

  if (tplErr || !template) {
    return { status: "error", message: "template_load_failed" }
  }

  // Preload recurring-bookings grouped by template id so we don't hit the
  // DB once per slot per recurring user.
  const { data: recurringRows } = await service
    .from("recurring_bookings")
    .select("user_id, schedule_template_id")
    .eq("is_active", true)
  const recurringByTemplate = new Map<string, string[]>()
  for (const r of recurringRows ?? []) {
    const list = recurringByTemplate.get(r.schedule_template_id) ?? []
    list.push(r.user_id)
    recurringByTemplate.set(r.schedule_template_id, list)
  }

  const slots = template as ScheduleSlot[]
  const weekStartLocal = mondayOf(anchor)

  let created = 0
  let skipped = 0
  let recurringBooked = 0
  let recurringSkipped = 0

  for (const slot of slots) {
    const dayLocal = addDays(weekStartLocal, slot.day_of_week)
    const sessionDate = formatISO(dayLocal, { representation: "date" })

    const localStart = new Date(dayLocal)
    localStart.setHours(slot.start_hour, slot.start_minute, 0, 0)
    const startAt = fromZonedTime(localStart, STUDIO_TZ)
    const endAt = new Date(startAt.getTime() + slot.duration_min * 60_000)
    const unlockAt = unlockAtFor(localStart)

    let sessionId: string | null = null

    // Look up any existing session at this (date, time, trainer). We use
    // .is(null) for null trainers because Postgres treats NULL as distinct,
    // so .eq("trainer", "") would never match. We also fetch with a list
    // (not .maybeSingle) so pre-existing duplicates don't fall through to
    // the insert branch and get even more duplicates piled on.
    let existsQuery = service
      .from("sessions")
      .select("id")
      .eq("session_date", sessionDate)
      .eq("start_at", startAt.toISOString())
      .limit(1)
    existsQuery = slot.trainer
      ? existsQuery.eq("trainer", slot.trainer)
      : existsQuery.is("trainer", null)
    const { data: existingRows } = await existsQuery
    const existing = existingRows?.[0] ?? null

    if (existing) {
      sessionId = existing.id
      skipped++
    } else {
      const { data: inserted, error } = await service
        .from("sessions")
        .insert({
          class_id: slot.class_id,
          session_date: sessionDate,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          capacity: slot.capacity,
          unlock_at: unlockAt.toISOString(),
          trainer: slot.trainer,
        })
        .select("id")
        .single()
      if (error || !inserted) {
        return { status: "error", message: error?.message ?? "insert_failed" }
      }
      sessionId = inserted.id
      created++
    }

    // Auto-book everyone pinned to this slot. Failures are non-fatal —
    // e.g. plan expired, already booked that day, etc.
    const recurringUserIds = recurringByTemplate.get(slot.id) ?? []
    for (const userId of recurringUserIds) {
      const { error: rpcErr } = await service.rpc("book_session_for", {
        p_user_id: userId,
        p_session_id: sessionId,
      })
      if (rpcErr) recurringSkipped++
      else recurringBooked++
    }
  }

  revalidatePath("/admin/sessions")
  revalidatePath("/book")
  return { status: "ok", created, skipped, recurringBooked, recurringSkipped }
}

/**
 * Generate sessions for the week containing today (Mon..Sun in studio
 * local time). Use this as a fallback when the Sunday auto-generation
 * was missed and the studio needs to open bookings for the current week.
 */
export async function generateCurrentWeekSessionsAction(): Promise<GenerateSessionsResult> {
  await requireAdmin()
  return generateForWeekContaining(new Date())
}

/**
 * Generate sessions for next week (Mon..Sun). This is what the admin
 * normally runs every Sunday — and what the cron at /api/cron/generate-week
 * runs automatically.
 */
export async function generateNextWeekSessionsAction(): Promise<GenerateSessionsResult> {
  await requireAdmin()
  return generateForWeekContaining(addDays(new Date(), 7))
}

/**
 * Cron-friendly variant: same as `generateNextWeekSessionsAction` but
 * without the `requireAdmin` gate. The route handler that calls this
 * MUST verify the `CRON_SECRET` header first.
 */
export async function generateNextWeekSessionsCron(): Promise<GenerateSessionsResult> {
  return generateForWeekContaining(addDays(new Date(), 7))
}
