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
  | { status: "ok"; created: number; skipped: number }
  | { status: "error"; message: string }

/**
 * Reads the schedule template and creates `sessions` rows for next week
 * (Mon..Sun). Idempotent: a unique index on (session_date, start_at) means
 * re-running just upserts the existing row count via skipped++. Each session
 * gets `unlock_at` set per the Sunday-unlock rule.
 */
export async function generateNextWeekSessionsAction(): Promise<GenerateSessionsResult> {
  await requireAdmin()
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

  const slots = template as ScheduleSlot[]
  const weekStartLocal = mondayOf(addDays(new Date(), 7))

  let created = 0
  let skipped = 0

  for (const slot of slots) {
    const dayLocal = addDays(weekStartLocal, slot.day_of_week)
    const sessionDate = formatISO(dayLocal, { representation: "date" })

    // Compose the start instant in studio local time, convert to UTC.
    const localStart = new Date(dayLocal)
    localStart.setHours(slot.start_hour, slot.start_minute, 0, 0)
    const startAt = fromZonedTime(localStart, STUDIO_TZ)
    const endAt = new Date(startAt.getTime() + slot.duration_min * 60_000)
    const unlockAt = unlockAtFor(localStart)

    // Check existence — uniqueness is now per (date, start, trainer), so
    // multiple trainers can have parallel sessions at the same time.
    const { data: existing } = await service
      .from("sessions")
      .select("id")
      .eq("session_date", sessionDate)
      .eq("start_at", startAt.toISOString())
      .eq("trainer", slot.trainer ?? "")
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    const { error } = await service.from("sessions").insert({
      class_id: slot.class_id,
      session_date: sessionDate,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      capacity: slot.capacity,
      unlock_at: unlockAt.toISOString(),
      trainer: slot.trainer,
    })
    if (error) {
      // Stop on first hard error so the admin sees it; partial creation is OK.
      return { status: "error", message: error.message }
    }
    created++
  }

  revalidatePath("/admin/sessions")
  return { status: "ok", created, skipped }
}
