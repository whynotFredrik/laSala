import { formatInTimeZone } from "date-fns-tz"
import { ro } from "date-fns/locale"

import { STUDIO_TZ } from "./rules"

/**
 * Format a session timestamp in Europe/Bucharest time, regardless of the
 * server's system TZ. Use this everywhere a session start/end is displayed
 * to a Romanian user.
 *
 * Without this helper, Server Components on Vercel (UTC) would render
 * `format(new Date('2024-06-01T16:00:00Z'), 'HH:mm')` as `16:00`, but the
 * session is really 18:00 Bucharest (UTC+2 in winter, UTC+3 in summer).
 */
export function formatStudio(
  value: Date | string,
  pattern: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value
  return formatInTimeZone(date, STUDIO_TZ, pattern, { locale: ro })
}
