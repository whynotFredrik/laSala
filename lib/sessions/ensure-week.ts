import "server-only"

import { addDays, formatISO } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

import { STUDIO_TZ, studioWeekStart, unlockAtFor } from "@/lib/booking/rules"
import type { createServiceClient } from "@/lib/supabase/service"

type ServiceClient = ReturnType<typeof createServiceClient>

type ScheduleSlot = {
  id: string
  day_of_week: number
  start_hour: number
  start_minute: number
  duration_min: number
  capacity: number
  class_id: string | null
  trainer: string | null
}

export type EnsureWeekResult = {
  /** Studio-local Monday of the week, YYYY-MM-DD. */
  weekStart: string
  created: number
  skipped: number
  /** Every session of the week (created or pre-existing), by template order. */
  sessionIds: string[]
}

/**
 * Make sure `sessions` rows exist for every enabled schedule_template slot
 * in the studio week containing `anchor` (Mon..Sun, Europe/Bucharest).
 *
 * Idempotent: an existing (date, start, trainer) tuple is left alone —
 * only its `schedule_template_id` is healed if it was still null (rows
 * generated before migration 0020). Safe to run every day.
 *
 * Generation only; recurring pins are booked separately by
 * `lib/booking/recurring.ts` so the same code path serves the cron, the
 * admin "add pin" action and plan activation.
 */
export async function ensureSessionsForWeek(
  service: ServiceClient,
  anchor: Date,
): Promise<EnsureWeekResult> {
  const { data: template, error } = await service
    .from("schedule_template")
    .select(
      "id, day_of_week, start_hour, start_minute, duration_min, capacity, class_id, trainer",
    )
    .eq("is_enabled", true)
    .order("day_of_week", { ascending: true })
    .order("start_hour", { ascending: true })
    .order("start_minute", { ascending: true })
  if (error || !template) {
    throw new Error(`template_load_failed: ${error?.message ?? "no data"}`)
  }

  const weekStartLocal = studioWeekStart(anchor)
  const weekStart = formatISO(weekStartLocal, { representation: "date" })

  let created = 0
  let skipped = 0
  const sessionIds: string[] = []

  for (const slot of template as ScheduleSlot[]) {
    const dayLocal = addDays(weekStartLocal, slot.day_of_week)
    const sessionDate = formatISO(dayLocal, { representation: "date" })

    const localStart = new Date(dayLocal)
    localStart.setHours(slot.start_hour, slot.start_minute, 0, 0)
    const startAt = fromZonedTime(localStart, STUDIO_TZ)
    const endAt = new Date(startAt.getTime() + slot.duration_min * 60_000)
    // Pass the real instant: unlockAtFor converts to studio time itself.
    const unlockAt = unlockAtFor(startAt)

    // Existing session at this (date, time, trainer)? `.is(null)` for null
    // trainers — Postgres treats NULL as distinct. We take a list (not
    // maybeSingle) so a pre-existing duplicate never falls through to insert.
    let existsQuery = service
      .from("sessions")
      .select("id, schedule_template_id")
      .eq("session_date", sessionDate)
      .eq("start_at", startAt.toISOString())
      .limit(1)
    existsQuery = slot.trainer
      ? existsQuery.eq("trainer", slot.trainer)
      : existsQuery.is("trainer", null)
    const { data: existingRows } = await existsQuery
    const existing = existingRows?.[0] ?? null

    if (existing) {
      if (existing.schedule_template_id !== slot.id) {
        await service
          .from("sessions")
          .update({ schedule_template_id: slot.id })
          .eq("id", existing.id)
      }
      sessionIds.push(existing.id)
      skipped++
      continue
    }

    const { data: inserted, error: insertErr } = await service
      .from("sessions")
      .insert({
        class_id: slot.class_id,
        schedule_template_id: slot.id,
        session_date: sessionDate,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        capacity: slot.capacity,
        unlock_at: unlockAt.toISOString(),
        trainer: slot.trainer,
      })
      .select("id")
      .single()
    if (insertErr || !inserted) {
      throw new Error(`session_insert_failed: ${insertErr?.message ?? ""}`)
    }
    sessionIds.push(inserted.id)
    created++
  }

  return { weekStart, created, skipped, sessionIds }
}
