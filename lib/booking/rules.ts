/**
 * Pure helpers for booking-window math. Mirrors the rules encoded in
 * supabase/migrations/0003_functions.sql — keep the two in sync.
 *
 * All time math runs in Europe/Bucharest because the studio's day boundaries
 * (Sunday-unlock, 3-hour cancel cutoff) are defined in local time.
 */

import { addDays, formatISO, getDay, startOfDay } from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"

export const STUDIO_TZ = "Europe/Bucharest"
export const CANCEL_LOCK_HOURS = 3
export const RESCHEDULE_PER_WEEK_CAP = 2

/**
 * "Now" in studio local time.
 */
export function studioNow(now: Date = new Date()): Date {
  return toZonedTime(now, STUDIO_TZ)
}

/**
 * Unlock instant for a given session date.
 *
 * Rule: sessions for week N+1 unlock at 00:00 Europe/Bucharest on Sunday of
 * week N — the day before that week's Monday. Concretely: go back to the
 * previous Sunday (Monday → 1 day, Sunday → 7 days), anchor at midnight
 * Bucharest, convert back to UTC.
 */
export function unlockAtFor(sessionDate: Date): Date {
  const local = toZonedTime(sessionDate, STUDIO_TZ)
  // ISO weekday: Mon=1 ... Sun=7. Subtracting it lands on the Sunday before
  // the session's week (a Sunday session unlocks with the rest of its week).
  const isoDay = local.getDay() === 0 ? 7 : local.getDay()
  const sunday = addDays(startOfDay(local), -isoDay)
  return fromZonedTime(sunday, STUDIO_TZ)
}

/**
 * True if the session is bookable right now (its unlock instant has passed).
 */
export function isUnlocked(unlockAt: Date | string, now: Date = new Date()) {
  const u = typeof unlockAt === "string" ? new Date(unlockAt) : unlockAt
  return u.getTime() <= now.getTime()
}

/**
 * True if the booking can still be cancelled (>= 3 hours before start).
 */
export function isCancellable(
  sessionStartAt: Date | string,
  now: Date = new Date(),
) {
  const s =
    typeof sessionStartAt === "string"
      ? new Date(sessionStartAt)
      : sessionStartAt
  const cutoff = s.getTime() - CANCEL_LOCK_HOURS * 60 * 60 * 1000
  return now.getTime() < cutoff
}

/**
 * The seven-day window we show on the book page, anchored at studio-local
 * midnight today. Returns ISO date strings (YYYY-MM-DD).
 */
export function nextSevenDays(now: Date = new Date()): string[] {
  const localToday = toZonedTime(now, STUDIO_TZ)
  const todayStart = startOfDay(localToday)
  return Array.from({ length: 7 }, (_, i) =>
    formatISO(addDays(todayStart, i), { representation: "date" }),
  )
}

/**
 * Today's date in the studio timezone as YYYY-MM-DD.
 */
export function studioDateISO(now: Date = new Date()): string {
  return formatISO(startOfDay(toZonedTime(now, STUDIO_TZ)), {
    representation: "date",
  })
}

/**
 * Studio-local Monday 00:00 of the ISO week containing `anchor`, as a
 * "zoned" Date (the same shape `toZonedTime` returns). Our schedule
 * template uses 0=Mon ... 6=Sun.
 */
export function studioWeekStart(anchor: Date = new Date()): Date {
  const local = toZonedTime(anchor, STUDIO_TZ)
  const day = getDay(local) // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = day === 0 ? -6 : 1 - day
  return startOfDay(addDays(local, offset))
}

/**
 * Whether next week's sessions should already exist. The daily sync keeps
 * the current week up to date every day and adds week N+1 from Saturday
 * of week N onward — one day before the Sunday-midnight unlock, so
 * recurring pins get their seat before walk-in bookings open.
 */
export function nextWeekDue(now: Date = new Date()): boolean {
  const day = getDay(toZonedTime(now, STUDIO_TZ))
  return day === 6 || day === 0
}
