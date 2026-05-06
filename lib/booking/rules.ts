/**
 * Pure helpers for booking-window math. Mirrors the rules encoded in
 * supabase/migrations/0003_functions.sql — keep the two in sync.
 *
 * All time math runs in Europe/Bucharest because the studio's day boundaries
 * (Sunday-unlock, 3-hour cancel cutoff) are defined in local time.
 */

import { addDays, formatISO, startOfDay } from "date-fns"
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
 * week N. Concretely: subtract 6 days from the session's Monday, anchor at
 * midnight Bucharest, convert back to UTC.
 */
export function unlockAtFor(sessionDate: Date): Date {
  const local = toZonedTime(sessionDate, STUDIO_TZ)
  // ISO weekday: Mon=1 ... Sun=7. We want the Sunday before the session's week.
  const isoDay = local.getDay() === 0 ? 7 : local.getDay()
  const daysToPriorSunday = isoDay + 6 // Monday → 7, Sunday → 13
  const sunday = addDays(startOfDay(local), -daysToPriorSunday)
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
