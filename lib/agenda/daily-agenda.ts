import { formatStudio } from "@/lib/booking/format"

/**
 * Pure helpers for the evening "tomorrow's schedule" email. No I/O so the
 * grouping and filtering can be unit-tested; the cron route loads the rows.
 */

export type AgendaSessionRow = {
  start_at: string
  end_at: string
  capacity: number
  trainer: string | null
  classes: { name_ro: string } | null
  bookings: {
    status: string
    profiles: { full_name: string | null; email: string } | null
  }[]
}

export type AgendaSession = {
  /** "18:00–19:00" in studio time. */
  time: string
  trainer: string | null
  className: string
  capacity: number
  /** Members with an active booking, sorted by name. */
  roster: string[]
}

export function toAgendaSessions(rows: AgendaSessionRow[]): AgendaSession[] {
  return [...rows]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((row) => ({
      time: `${formatStudio(row.start_at, "HH:mm")}–${formatStudio(row.end_at, "HH:mm")}`,
      trainer: row.trainer,
      className: row.classes?.name_ro ?? "Sesiune",
      capacity: row.capacity,
      roster: row.bookings
        .filter((b) => b.status === "booked")
        .map((b) => b.profiles?.full_name?.trim() || b.profiles?.email || "")
        .filter(Boolean)
        .sort((x, y) => x.localeCompare(y, "ro")),
    }))
}

/** A recipient's slice: everything, or one trainer's sessions. */
export function agendaFor(
  sessions: AgendaSession[],
  trainer: string | null,
): AgendaSession[] {
  return trainer ? sessions.filter((s) => s.trainer === trainer) : sessions
}
