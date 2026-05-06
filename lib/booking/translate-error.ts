/**
 * Maps Postgres errors raised by book_session / cancel_booking /
 * reschedule_booking to translation keys in `messages/ro.json` ->
 * "bookingErrors".
 *
 * The function uses `raise exception '...'` — the message ends up in
 * `error.message`. Codes ('P0001' etc.) come back as `error.code` but are
 * generic, so we match on text fragments.
 */

const MAP: Array<{ test: RegExp; key: string }> = [
  { test: /not authenticated/i, key: "not_authenticated" },
  { test: /session not found/i, key: "session_not_found" },
  { test: /session not yet bookable/i, key: "session_not_unlocked" },
  { test: /new session not yet bookable/i, key: "session_not_unlocked" },
  { test: /session is full/i, key: "session_full" },
  { test: /new session is full/i, key: "session_full" },
  { test: /no active plan/i, key: "no_active_plan" },
  { test: /plan expires before/i, key: "plan_expires_before_session" },
  { test: /no sessions remaining/i, key: "plan_exhausted" },
  { test: /already booked for this date/i, key: "already_booked_today" },
  { test: /already booked for the new date/i, key: "already_booked_today" },
  { test: /booking not found/i, key: "booking_not_found" },
  { test: /booking not active/i, key: "booking_not_active" },
  { test: /forbidden/i, key: "forbidden" },
  { test: /cannot cancel within 3 hours/i, key: "cancel_lock_window" },
  { test: /cannot reschedule within 3 hours/i, key: "cancel_lock_window" },
  { test: /reschedule limit reached/i, key: "reschedule_cap" },
]

export function translateBookingError(
  message: string | null | undefined,
): string {
  if (!message) return "unknown"
  for (const { test, key } of MAP) {
    if (test.test(message)) return key
  }
  return "unknown"
}
