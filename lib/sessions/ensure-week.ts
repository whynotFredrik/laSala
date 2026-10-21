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
  const weekEnd = formatISO(addDays(weekStartLocal, 6), {
    representation: "date",
  })

  // One read for the whole week instead of one per slot: the cron used to
  // run past its time limit doing hundreds of sequential round trips.
  const { data: weekRows, error: weekErr } = await service
    .from("sessions")
    .select("id, session_date, start_at, trainer, schedule_template_id")
    .gte("session_date", weekStart)
    .lte("session_date", weekEnd)
  if (weekErr) throw new Error(`sessions_load_failed: ${weekErr.message}`)

  // Existing session at this (date, time, trainer)? First match wins, so a
  // pre-existing duplicate never falls through to insert.
  const existingByKey = new Map<
    string,
    { id: string; schedule_template_id: string | null }
  >()
  for (const row of weekRows ?? []) {
    const key = sessionKey(row.session_date, new Date(row.start_at), row.trainer)
    if (!existingByKey.has(key)) existingByKey.set(key, row)
  }

  type Insert = {
    class_id: string | null
    schedule_template_id: string
    session_date: string
    start_at: string
    end_at: string
    capacity: number
    unlock_at: string
    trainer: string | null
  }

  // Per template slot, in template order: an existing id or a pending insert.
  const plan: Array<{ id: string } | { insert: Insert; key: string }> = []
  const heals: Array<{ id: string; templateId: string }> = []

  for (const slot of template as ScheduleSlot[]) {
    const dayLocal = addDays(weekStartLocal, slot.day_of_week)
    const sessionDate = formatISO(dayLocal, { representation: "date" })

    const localStart = new Date(dayLocal)
    localStart.setHours(slot.start_hour, slot.start_minute, 0, 0)
    const startAt = fromZonedTime(localStart, STUDIO_TZ)
    const endAt = new Date(startAt.getTime() + slot.duration_min * 60_000)
    // Pass the real instant: unlockAtFor converts to studio time itself.
    const unlockAt = unlockAtFor(startAt)

    const key = sessionKey(sessionDate, startAt, slot.trainer)
    const existing = existingByKey.get(key)
    if (existing) {
      if (existing.schedule_template_id !== slot.id) {
        heals.push({ id: existing.id, templateId: slot.id })
      }
      plan.push({ id: existing.id })
      continue
    }

    plan.push({
      key,
      insert: {
        class_id: slot.class_id,
        schedule_template_id: slot.id,
        session_date: sessionDate,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        capacity: slot.capacity,
        unlock_at: unlockAt.toISOString(),
        trainer: slot.trainer,
      },
    })
  }

  // Rows generated before migration 0020 still lack their template link.
  // Rare (one-off healing), so one update per row is fine.
  await Promise.all(
    heals.map(({ id, templateId }) =>
      service
        .from("sessions")
        .update({ schedule_template_id: templateId })
        .eq("id", id),
    ),
  )

  const inserts = plan.flatMap((p) => ("insert" in p ? [p.insert] : []))
  const insertedByKey = new Map<string, string>()
  if (inserts.length > 0) {
    const { data: inserted, error: insertErr } = await service
      .from("sessions")
      .insert(inserts)
      .select("id, session_date, start_at, trainer")
    if (insertErr || !inserted) {
      throw new Error(`session_insert_failed: ${insertErr?.message ?? ""}`)
    }
    for (const row of inserted) {
      insertedByKey.set(
        sessionKey(row.session_date, new Date(row.start_at), row.trainer),
        row.id,
      )
    }
  }

  const sessionIds: string[] = []
  for (const p of plan) {
    const id = "id" in p ? p.id : insertedByKey.get(p.key)
    if (id) sessionIds.push(id)
  }
  const created = inserts.length
  const skipped = plan.length - created

  return { weekStart, created, skipped, sessionIds }
}

/**
 * Identity of a session slot: studio date, start instant, trainer. The
 * instant is compared as epoch millis because Postgres returns
 * `+00:00` offsets while we build `Z` ISO strings.
 */
function sessionKey(
  sessionDate: string,
  startAt: Date,
  trainer: string | null,
): string {
  return `${sessionDate}|${startAt.getTime()}|${trainer ?? ""}`
}
