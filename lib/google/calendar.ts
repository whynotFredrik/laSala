import "server-only"

import { JWT } from "google-auth-library"

import { APP_TAG, type CalendarEventPayload } from "@/lib/google/event-payload"
import { getCalendarConfig } from "@/lib/google/config"

/**
 * Thin client for the Google Calendar v3 REST API using a service account.
 * Deliberately not `googleapis` (≈80 MB, slow cold starts) — we only need
 * four endpoints. Auth: `google-auth-library` JWT, which caches the access
 * token until it expires.
 */

const API = "https://www.googleapis.com/calendar/v3"
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
const RETRY_DELAYS_MS = [500, 1500, 4500]

export class CalendarApiError extends Error {
  readonly status: number
  readonly reason: string | null

  constructor(status: number, reason: string | null, message: string) {
    super(message)
    this.name = "CalendarApiError"
    this.status = status
    this.reason = reason
  }
}

export type RemoteEvent = {
  id: string
  status?: string
  htmlLink?: string
  extendedProperties?: { private?: Record<string, string> }
}

let jwt: JWT | null = null

async function getAccessToken(): Promise<string> {
  const config = getCalendarConfig()
  if (!config) throw new Error("Google Calendar is not configured")
  if (!jwt) {
    jwt = new JWT({ email: config.email, key: config.privateKey, scopes: SCOPES })
  }
  const { token } = await jwt.getAccessToken()
  if (!token) throw new Error("Could not obtain a Google access token")
  return token
}

/** Test seam: replace the token getter so no real JWT is signed. */
let tokenGetter: () => Promise<string> = getAccessToken
export function __setTokenGetterForTests(fn: (() => Promise<string>) | null) {
  tokenGetter = fn ?? getAccessToken
}

function isRetryable(status: number, reason: string | null) {
  if (status === 429 || status >= 500) return true
  return (
    status === 403 &&
    (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")
  )
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null }> {
  const token = await tokenGetter()
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (res.ok) {
      if (res.status === 204) return { status: res.status, data: null }
      const text = await res.text()
      return { status: res.status, data: text ? (JSON.parse(text) as T) : null }
    }

    let reason: string | null = null
    let message = `Google Calendar API ${res.status}`
    try {
      const err = (await res.json()) as {
        error?: { message?: string; errors?: { reason?: string }[] }
      }
      reason = err.error?.errors?.[0]?.reason ?? null
      if (err.error?.message) message = `${message}: ${err.error.message}`
    } catch {
      // non-JSON error body — keep the generic message
    }

    if (isRetryable(res.status, reason) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    throw new CalendarApiError(res.status, reason, message)
  }
}

const enc = encodeURIComponent

export async function insertEvent(
  calendarId: string,
  payload: CalendarEventPayload & { id: string },
): Promise<RemoteEvent> {
  const { data } = await request<RemoteEvent>(
    "POST",
    `/calendars/${enc(calendarId)}/events?sendUpdates=none`,
    payload,
  )
  if (!data) throw new Error("Empty response from events.insert")
  return data
}

export async function patchEvent(
  calendarId: string,
  eventId: string,
  payload: Partial<CalendarEventPayload>,
): Promise<RemoteEvent> {
  const { data } = await request<RemoteEvent>(
    "PATCH",
    `/calendars/${enc(calendarId)}/events/${enc(eventId)}?sendUpdates=none`,
    payload,
  )
  if (!data) throw new Error("Empty response from events.patch")
  return data
}

/** Deleting an already-deleted event (404/410) counts as success. */
export async function deleteEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await request<null>(
      "DELETE",
      `/calendars/${enc(calendarId)}/events/${enc(eventId)}?sendUpdates=none`,
    )
  } catch (err) {
    if (err instanceof CalendarApiError && (err.status === 404 || err.status === 410)) {
      return
    }
    throw err
  }
}

/** Lists every event tagged by this app inside [timeMin, timeMax). */
export async function listAppEvents(
  calendarId: string,
  window: { timeMin: Date; timeMax: Date },
): Promise<RemoteEvent[]> {
  const out: RemoteEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      privateExtendedProperty: `app=${APP_TAG}`,
      singleEvents: "true",
      maxResults: "250",
      timeMin: window.timeMin.toISOString(),
      timeMax: window.timeMax.toISOString(),
    })
    if (pageToken) params.set("pageToken", pageToken)
    const { data } = await request<{ items?: RemoteEvent[]; nextPageToken?: string }>(
      "GET",
      `/calendars/${enc(calendarId)}/events?${params.toString()}`,
    )
    out.push(...(data?.items ?? []))
    pageToken = data?.nextPageToken
  } while (pageToken)
  return out
}
