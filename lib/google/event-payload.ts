import { createHash } from "node:crypto"

import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import type { Trainer } from "@/lib/constants"

/**
 * Pure helpers that turn a session (plus its roster) into a Google
 * Calendar event payload. No I/O here so this file is unit-testable.
 */

export type SessionForCalendar = {
  id: string
  start_at: string
  end_at: string
  capacity: number
  booked_count: number
  trainer: string | null
  className: string | null
  /** Full names of members with status = 'booked'. */
  roster: string[]
}

export type CalendarEventPayload = {
  summary: string
  description: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  colorId?: string
  status: "confirmed"
  extendedProperties: { private: { app: "lasala"; sessionId: string } }
  reminders: { useDefault: false }
}

export const APP_TAG = "lasala"

/**
 * Google event colorIds, mirroring the trainer badge palette on
 * app/admin/sessions/page.tsx (blue / fuchsia / amber).
 */
export const TRAINER_COLOR_IDS: Record<Trainer, string> = {
  Eugen: "9", // blueberry
  Marina: "3", // grape
  Ana: "5", // banana
}

const EVENT_ID_RE = /^[a-v0-9]{5,1024}$/

/**
 * Deterministic Google event id for a session. Google accepts ids made of
 * base32hex characters (0-9, a-v), 5–1024 long; a UUID without dashes is
 * 32 lowercase hex chars, so it qualifies. With `salt` we derive an
 * alternative id for the rare case where the primary one is permanently
 * unusable (event purged from Google's trash keeps the id reserved).
 */
export function deriveEventId(sessionId: string, salt?: number): string {
  const id =
    salt === undefined
      ? sessionId.replace(/-/g, "").toLowerCase()
      : createHash("sha256")
          .update(`${sessionId}:${salt}`)
          .digest("hex")
          .slice(0, 32)
  if (!EVENT_ID_RE.test(id)) {
    throw new Error(`Derived event id is not valid for Google: ${id}`)
  }
  return id
}

export function buildEventPayload(
  session: SessionForCalendar,
  adminUrl: string,
): CalendarEventPayload {
  const time = formatStudio(session.start_at, "HH:mm")
  const who = [session.trainer, session.className].filter(Boolean).join(" – ")
  const summary = `${time}${who ? ` ${who}` : ""} (${session.booked_count}/${session.capacity})`

  const roster = [...session.roster].sort((a, b) => a.localeCompare(b, "ro"))
  const description = [...roster, "", adminUrl].join("\n").trim()

  const colorId =
    session.trainer && session.trainer in TRAINER_COLOR_IDS
      ? TRAINER_COLOR_IDS[session.trainer as Trainer]
      : undefined

  return {
    summary,
    description,
    start: { dateTime: new Date(session.start_at).toISOString(), timeZone: STUDIO_TZ },
    end: { dateTime: new Date(session.end_at).toISOString(), timeZone: STUDIO_TZ },
    ...(colorId ? { colorId } : {}),
    status: "confirmed",
    extendedProperties: { private: { app: APP_TAG, sessionId: session.id } },
    reminders: { useDefault: false },
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    )
  }
  return value
}

/** Stable sha256 over the payload, independent of key order. */
export function hashPayload(payload: CalendarEventPayload): string {
  return createHash("sha256")
    .update(JSON.stringify(sortKeys(payload)))
    .digest("hex")
}
