import "server-only"

import { z } from "zod"

/**
 * Google Calendar integration config. All three env vars must be present
 * for the integration to be enabled; otherwise every sync entry point is a
 * no-op so local dev and preview deploys never break.
 *
 * Setup instructions live in docs/GOOGLE_CALENDAR.md.
 */
const schema = z.object({
  email: z.string().email(),
  privateKey: z.string().includes("BEGIN PRIVATE KEY"),
  calendarId: z.string().min(1),
})

export type CalendarConfig = z.infer<typeof schema>

let cached: CalendarConfig | null | undefined

export function getCalendarConfig(): CalendarConfig | null {
  if (cached !== undefined) return cached

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  if (!email || !rawKey || !calendarId) {
    cached = null
    return cached
  }

  // Vercel stores the pasted key with literal "\n" sequences; a key pasted
  // with real newlines is left untouched by this replace.
  const parsed = schema.safeParse({
    email,
    privateKey: rawKey.replace(/\\n/g, "\n"),
    calendarId,
  })
  cached = parsed.success ? parsed.data : null
  return cached
}

export function isCalendarConfigured(): boolean {
  return getCalendarConfig() !== null
}
