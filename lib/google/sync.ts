import "server-only"

import { addDays, formatISO, startOfDay } from "date-fns"
import { toZonedTime } from "date-fns-tz"

import { STUDIO_TZ } from "@/lib/booking/rules"
import {
  CalendarApiError,
  deleteEvent,
  insertEvent,
  listAppEvents,
  patchEvent,
  type RemoteEvent,
} from "@/lib/google/calendar"
import { getCalendarConfig } from "@/lib/google/config"
import {
  buildEventPayload,
  deriveEventId,
  hashPayload,
  type CalendarEventPayload,
  type SessionForCalendar,
} from "@/lib/google/event-payload"
import { planReconcile } from "@/lib/google/reconcile-plan"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * One-way sync: app sessions -> Google Calendar events.
 *
 * Nothing in this module throws to its caller. Every failure is recorded
 * on the `calendar_events` row (`last_error`) and counted in the returned
 * summary, because callers are fire-and-forget hooks after a booking or
 * a cron job that must not fail the user's request.
 */

export type SyncError = { sessionId?: string; eventId?: string; message: string }

export type SyncSummary = {
  configured: boolean
  upserted: number
  skipped: number
  deleted: number
  failed: number
  errors: SyncError[]
}

const CONCURRENCY = 3
const MAX_ID_SALT = 2

function emptySummary(configured: boolean): SyncSummary {
  return { configured, upserted: 0, skipped: 0, deleted: 0, failed: 0, errors: [] }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

function adminSessionsUrl() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")
  return `${base}/admin/sessions`
}

function isGone(err: unknown) {
  return err instanceof CalendarApiError && (err.status === 404 || err.status === 410)
}

function isConflict(err: unknown) {
  return err instanceof CalendarApiError && err.status === 409
}

/**
 * Creates or updates the Google event for a session and returns the id
 * actually in use. Handles Google's id-reservation quirks:
 *  - insert on an id of a previously deleted event -> 409; a patch with
 *    `status: confirmed` un-deletes it.
 *  - patch on an id purged from trash -> 404/410; re-insert with the id,
 *    and if that 409s too, fall back to a salted id.
 */
async function upsertRemote(
  calendarId: string,
  sessionId: string,
  knownEventId: string | null,
  payload: CalendarEventPayload,
): Promise<RemoteEvent> {
  if (knownEventId) {
    try {
      return await patchEvent(calendarId, knownEventId, payload)
    } catch (err) {
      if (!isGone(err)) throw err
    }
    try {
      return await insertEvent(calendarId, { ...payload, id: knownEventId })
    } catch (err) {
      if (!isConflict(err)) throw err
    }
  }

  for (let salt = 0; salt <= MAX_ID_SALT; salt++) {
    const id = deriveEventId(sessionId, salt === 0 ? undefined : salt)
    if (id === knownEventId) continue
    try {
      return await insertEvent(calendarId, { ...payload, id })
    } catch (err) {
      if (!isConflict(err)) throw err
    }
    try {
      return await patchEvent(calendarId, id, payload)
    } catch (err) {
      if (!isGone(err)) throw err
      // purged event still reserves this id — try the next salt
    }
  }
  throw new Error("Could not allocate a Google event id for this session")
}

type SessionRow = {
  id: string
  start_at: string
  end_at: string
  capacity: number
  booked_count: number
  trainer: string | null
  classes: { name_ro: string } | null
  bookings: {
    status: string
    profiles: { full_name: string | null; email: string } | null
  }[]
}

function toSessionForCalendar(row: SessionRow): SessionForCalendar {
  return {
    id: row.id,
    start_at: row.start_at,
    end_at: row.end_at,
    capacity: row.capacity,
    booked_count: row.booked_count,
    trainer: row.trainer,
    className: row.classes?.name_ro ?? null,
    roster: row.bookings
      .filter((b) => b.status === "booked")
      .map((b) => b.profiles?.full_name?.trim() || b.profiles?.email || "")
      .filter(Boolean),
  }
}

/**
 * Push the given sessions to Google. Unchanged events (same content hash,
 * no previous error) are skipped unless `force`. Ids that no longer
 * resolve to a session but still have a mapping row get their event
 * deleted.
 */
export async function syncSessions(
  sessionIds: string[],
  opts: { force?: boolean } = {},
): Promise<SyncSummary> {
  const config = getCalendarConfig()
  if (!config) return emptySummary(false)
  const summary = emptySummary(true)
  const ids = Array.from(new Set(sessionIds))
  if (ids.length === 0) return summary

  try {
    const service = createServiceClient()
    const { data: sessions, error: sErr } = await service
      .from("sessions")
      .select(
        "id, start_at, end_at, capacity, booked_count, trainer, classes(name_ro), bookings(status, profiles(full_name, email))",
      )
      .in("id", ids)
    if (sErr) throw new Error(`sessions load failed: ${sErr.message}`)

    const { data: rows, error: rErr } = await service
      .from("calendar_events")
      .select("id, session_id, google_event_id, content_hash, last_error")
      .eq("google_calendar_id", config.calendarId)
      .in("session_id", ids)
    if (rErr) throw new Error(`calendar_events load failed: ${rErr.message}`)

    const rowBySession = new Map(rows.map((r) => [r.session_id, r]))
    const adminUrl = adminSessionsUrl()
    const now = new Date().toISOString()

    await mapWithConcurrency(sessions as SessionRow[], CONCURRENCY, async (row) => {
      const session = toSessionForCalendar(row)
      const payload = buildEventPayload(session, adminUrl)
      const hash = hashPayload(payload)
      const existing = rowBySession.get(row.id)

      if (
        !opts.force &&
        existing &&
        existing.content_hash === hash &&
        existing.last_error === null
      ) {
        summary.skipped++
        return
      }

      try {
        const remote = await upsertRemote(
          config.calendarId,
          row.id,
          existing?.google_event_id ?? null,
          payload,
        )
        if (existing && existing.google_event_id !== remote.id) {
          // Id changed (salted fallback) — retire the old mapping row first
          // so the unique (calendar, event) constraint is not violated.
          await service.from("calendar_events").delete().eq("id", existing.id)
        }
        const { error: uErr } = await service.from("calendar_events").upsert(
          {
            session_id: row.id,
            google_calendar_id: config.calendarId,
            google_event_id: remote.id,
            html_link: remote.htmlLink ?? null,
            content_hash: hash,
            synced_at: now,
            last_error: null,
            updated_at: now,
          },
          { onConflict: "google_calendar_id,google_event_id" },
        )
        if (uErr) throw new Error(`mapping upsert failed: ${uErr.message}`)
        summary.upserted++
      } catch (err) {
        const message = errorMessage(err)
        summary.failed++
        summary.errors.push({ sessionId: row.id, message })
        await service.from("calendar_events").upsert(
          {
            session_id: row.id,
            google_calendar_id: config.calendarId,
            google_event_id: existing?.google_event_id ?? deriveEventId(row.id),
            content_hash: null,
            last_error: message,
            updated_at: now,
          },
          { onConflict: "google_calendar_id,google_event_id" },
        )
      }
    })

    // Ids we were asked about that no longer exist as sessions.
    const liveIds = new Set((sessions ?? []).map((s) => s.id))
    const staleRows = rows.filter((r) => r.session_id && !liveIds.has(r.session_id))
    await deleteRows(config.calendarId, staleRows, summary)
  } catch (err) {
    summary.failed++
    summary.errors.push({ message: errorMessage(err) })
  }
  return summary
}

async function deleteRows(
  calendarId: string,
  rows: { id: string; google_event_id: string }[],
  summary: SyncSummary,
) {
  if (rows.length === 0) return
  const service = createServiceClient()
  await mapWithConcurrency(rows, CONCURRENCY, async (r) => {
    try {
      await deleteEvent(calendarId, r.google_event_id)
      await service.from("calendar_events").delete().eq("id", r.id)
      summary.deleted++
    } catch (err) {
      summary.failed++
      summary.errors.push({ eventId: r.google_event_id, message: errorMessage(err) })
    }
  })
}

async function deleteRemoteIds(
  calendarId: string,
  eventIds: string[],
  summary: SyncSummary,
) {
  if (eventIds.length === 0) return
  const service = createServiceClient()
  await mapWithConcurrency(eventIds, CONCURRENCY, async (eventId) => {
    try {
      await deleteEvent(calendarId, eventId)
      await service
        .from("calendar_events")
        .delete()
        .eq("google_calendar_id", calendarId)
        .eq("google_event_id", eventId)
      summary.deleted++
    } catch (err) {
      summary.failed++
      summary.errors.push({ eventId, message: errorMessage(err) })
    }
  })
}

function studioDate(d: Date) {
  return formatISO(startOfDay(toZonedTime(d, STUDIO_TZ)), { representation: "date" })
}

/**
 * Full reconcile over a date window (default: yesterday .. +21 days, studio
 * local dates): push every session, delete events for orphaned mapping
 * rows, then sweep Google for tagged events that no longer match a session.
 */
export async function reconcileCalendar(
  opts: { from?: Date; to?: Date; force?: boolean } = {},
): Promise<SyncSummary> {
  const config = getCalendarConfig()
  if (!config) return emptySummary(false)

  const now = new Date()
  const from = opts.from ?? addDays(now, -1)
  const to = opts.to ?? addDays(now, 21)
  const fromDate = studioDate(from)
  const toDate = studioDate(to)

  let summary = emptySummary(true)
  try {
    const service = createServiceClient()
    const { data: sessions, error: sErr } = await service
      .from("sessions")
      .select("id")
      .gte("session_date", fromDate)
      .lte("session_date", toDate)
    if (sErr) throw new Error(`sessions load failed: ${sErr.message}`)
    const sessionIds = new Set((sessions ?? []).map((s) => s.id))

    summary = await syncSessions(Array.from(sessionIds), { force: opts.force })

    // 1. Orphan mapping rows (session deleted -> session_id set null).
    const { data: orphanRows, error: oErr } = await service
      .from("calendar_events")
      .select("id, session_id, google_event_id")
      .eq("google_calendar_id", config.calendarId)
      .is("session_id", null)
    if (oErr) throw new Error(`orphan load failed: ${oErr.message}`)
    await deleteRows(config.calendarId, orphanRows, summary)

    // 2. Remote sweep for tagged events whose session is gone.
    const remote = await listAppEvents(config.calendarId, {
      timeMin: startOfDay(toZonedTime(from, STUDIO_TZ)),
      timeMax: addDays(startOfDay(toZonedTime(to, STUDIO_TZ)), 1),
    })
    const remoteSessionIds = remote
      .map((e) => e.extendedProperties?.private?.sessionId)
      .filter((v): v is string => Boolean(v))
    const { data: existing, error: eErr } = remoteSessionIds.length
      ? await service.from("sessions").select("id").in("id", remoteSessionIds)
      : { data: [], error: null }
    if (eErr) throw new Error(`remote session check failed: ${eErr.message}`)
    const liveIds = new Set((existing ?? []).map((s) => s.id))

    const { data: rows, error: rErr } = await service
      .from("calendar_events")
      .select("id, session_id, google_event_id")
      .eq("google_calendar_id", config.calendarId)
    if (rErr) throw new Error(`calendar_events load failed: ${rErr.message}`)

    // Sessions we know are alive: everything in the window plus whatever
    // the remote tags pointed at that still exists. Rows for sessions
    // outside that set are simply out of scope, not orphans.
    const known = new Set([...sessionIds, ...liveIds])
    const plan = planReconcile({
      sessionIds: known,
      rows: rows.filter((r) => r.session_id === null || known.has(r.session_id)),
      remote: remote
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({
          id: e.id,
          sessionId: e.extendedProperties?.private?.sessionId ?? null,
        })),
    })
    await deleteRemoteIds(config.calendarId, plan.strayRemoteIds, summary)
  } catch (err) {
    summary.failed++
    summary.errors.push({ message: errorMessage(err) })
  }
  return summary
}

/** Delete the Google events (and mapping rows) for the given sessions. */
export async function deleteEventsForSessions(
  sessionIds: string[],
): Promise<SyncSummary> {
  const config = getCalendarConfig()
  if (!config) return emptySummary(false)
  const summary = emptySummary(true)
  if (sessionIds.length === 0) return summary
  try {
    const service = createServiceClient()
    const { data: rows, error } = await service
      .from("calendar_events")
      .select("id, google_event_id")
      .eq("google_calendar_id", config.calendarId)
      .in("session_id", sessionIds)
    if (error) throw new Error(`calendar_events load failed: ${error.message}`)
    await deleteRows(config.calendarId, rows, summary)
  } catch (err) {
    summary.failed++
    summary.errors.push({ message: errorMessage(err) })
  }
  return summary
}
