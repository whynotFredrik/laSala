import "server-only"

import { after } from "next/server"

import { isCalendarConfigured } from "@/lib/google/config"
import { syncSessions } from "@/lib/google/sync"

/**
 * Fire-and-forget calendar sync for the given sessions, run after the
 * current server action / route handler has sent its response (Next 15
 * `after()`, backed by `waitUntil` on Vercel). Safe to call from any
 * mutation: it is a no-op when the integration is not configured and it
 * never throws — sync failures are recorded on `calendar_events`.
 */
export function scheduleCalendarSync(
  sessionIds: (string | null | undefined)[],
): void {
  const ids = Array.from(
    new Set(sessionIds.filter((id): id is string => Boolean(id))),
  )
  if (ids.length === 0 || !isCalendarConfigured()) return
  after(async () => {
    try {
      await syncSessions(ids)
    } catch {
      // syncSessions already swallows; this guard only protects `after`.
    }
  })
}
