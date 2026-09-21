import { formatInTimeZone } from "date-fns-tz"

import type { PinOutcome, RecurringSkipReason } from "@/lib/booking/recurring"
import { STUDIO_TZ } from "@/lib/booking/rules"

/**
 * Pure helpers for the "your sessions this week" message sent to members
 * with recurring pins. Kept free of I/O so it can be unit-tested.
 */

export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const
export type DayKey = (typeof DAY_KEYS)[number]

export type SummaryLine = {
  startAt: string
  dayKey: DayKey
  /** HH:mm in studio time. */
  time: string
  trainer: string | null
  /** Legacy grace booking (feature removed Aug 2026; old rows may remain). */
  grace: boolean
}

export type SummarySkip = Omit<SummaryLine, "grace"> & {
  reason: RecurringSkipReason
}

export type WeeklySummary = {
  booked: SummaryLine[]
  skipped: SummarySkip[]
}

function dayKeyFor(startAt: string): DayKey {
  // ISO weekday in studio time: 1=Mon .. 7=Sun.
  const iso = Number(formatInTimeZone(new Date(startAt), STUDIO_TZ, "i"))
  return DAY_KEYS[iso - 1] ?? "monday"
}

function timeFor(startAt: string): string {
  return formatInTimeZone(new Date(startAt), STUDIO_TZ, "HH:mm")
}

/**
 * Merge the member's confirmed bookings for the target week with this
 * run's pin outcomes. Bookings win over outcomes for the same session
 * (an `existing` outcome and the booking row describe the same thing);
 * only `skipped` outcomes whose session has no booking are reported.
 */
export function buildWeeklySummary(input: {
  booked: { sessionId: string; startAt: string; trainer: string | null; grace: boolean }[]
  outcomes: PinOutcome[]
}): WeeklySummary {
  const bookedBySession = new Map<string, SummaryLine>()
  for (const b of input.booked) {
    bookedBySession.set(b.sessionId, {
      startAt: b.startAt,
      dayKey: dayKeyFor(b.startAt),
      time: timeFor(b.startAt),
      trainer: b.trainer,
      grace: b.grace,
    })
  }
  for (const o of input.outcomes) {
    if (o.status === "skipped" || bookedBySession.has(o.sessionId)) continue
    bookedBySession.set(o.sessionId, {
      startAt: o.startAt,
      dayKey: dayKeyFor(o.startAt),
      time: timeFor(o.startAt),
      trainer: o.trainer,
      grace: false,
    })
  }

  const skippedBySession = new Map<string, SummarySkip>()
  for (const o of input.outcomes) {
    if (o.status !== "skipped" || bookedBySession.has(o.sessionId)) continue
    if (skippedBySession.has(o.sessionId)) continue
    skippedBySession.set(o.sessionId, {
      startAt: o.startAt,
      dayKey: dayKeyFor(o.startAt),
      time: timeFor(o.startAt),
      trainer: o.trainer,
      reason: o.reason ?? "unknown",
    })
  }

  const byStart = (a: { startAt: string }, b: { startAt: string }) =>
    a.startAt.localeCompare(b.startAt)
  return {
    booked: Array.from(bookedBySession.values()).sort(byStart),
    skipped: Array.from(skippedBySession.values()).sort(byStart),
  }
}

export function weeklySummaryDedupeKey(weekStartISO: string): string {
  return `weekly_summary:${weekStartISO}`
}

/**
 * Render one line per session, e.g. "Luni 18:00 · Eugen (sesiune de grație)".
 * `dayName` / `reasonText` / `graceSuffix` come from the caller's
 * translator so this stays locale-agnostic.
 */
export function formatSummaryLines(
  summary: WeeklySummary,
  t: {
    dayName: (key: DayKey) => string
    reasonText: (reason: RecurringSkipReason) => string
    graceSuffix: string
  },
): { booked: string[]; skipped: string[] } {
  const base = (l: { dayKey: DayKey; time: string; trainer: string | null }) =>
    `${t.dayName(l.dayKey)} ${l.time}${l.trainer ? ` · ${l.trainer}` : ""}`
  return {
    booked: summary.booked.map(
      (l) => `${base(l)}${l.grace ? ` ${t.graceSuffix}` : ""}`,
    ),
    skipped: summary.skipped.map((l) => `${base(l)} — ${t.reasonText(l.reason)}`),
  }
}
