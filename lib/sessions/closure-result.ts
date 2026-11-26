import { z } from "zod"

/**
 * Results of `admin_close_studio_days` / `admin_reopen_studio_day`
 * (migration 0037). Both return jsonb, so the shape is checked here before
 * the app notifies anyone.
 */

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const cancelledBooking = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  session_id: z.string().min(1),
})

export const closeResultSchema = z.object({
  /** Days this call closed (already closed days are left out). */
  new_days: z.array(DAY),
  cancelled: z.array(cancelledBooking),
  /** One entry per plan extended by this call. */
  extended: z.array(
    z.object({
      user_id: z.string().min(1),
      plan_id: z.string().min(1),
      days: z.number().int().positive(),
      dates: z.array(DAY),
      /** The plan's end_date after the extension. */
      end_date: DAY,
    }),
  ),
})

export type CloseResult = z.infer<typeof closeResultSchema>
export type CancelledBooking = CloseResult["cancelled"][number]
export type PlanExtension = CloseResult["extended"][number]

export const reopenResultSchema = z.object({
  shortened: z.array(
    z.object({
      user_id: z.string().min(1),
      plan_id: z.string().min(1),
      end_date: DAY,
    }),
  ),
  /** Bookings past a shortened end_date, cancelled and refunded. */
  cancelled: z.array(cancelledBooking),
})

export type ReopenResult = z.infer<typeof reopenResultSchema>

export type ClosureNotice =
  /** A cancelled booking; `extension` is set when the member's plan grew. */
  | { kind: "cancelled"; booking: CancelledBooking; extension: PlanExtension | null }
  /** A member with no booking on the closed days whose plan grew. */
  | { kind: "extended"; extension: PlanExtension }

/**
 * What to tell each member after a closure: every cancelled booking gets
 * its own notice (mentioning the extension, if any), and members whose
 * plan was extended without a booking on those days get one notice each.
 */
export function closureNotices(result: CloseResult): ClosureNotice[] {
  const extensionByUser = new Map(result.extended.map((e) => [e.user_id, e]))
  const notified = new Set<string>()
  const notices: ClosureNotice[] = result.cancelled.map((booking) => {
    notified.add(booking.user_id)
    return {
      kind: "cancelled",
      booking,
      extension: extensionByUser.get(booking.user_id) ?? null,
    }
  })
  for (const extension of result.extended) {
    if (!notified.has(extension.user_id)) {
      notices.push({ kind: "extended", extension })
    }
  }
  return notices
}

/** Bookings cancelled on reopen, counted per member. */
export function cancelledCountByUser(
  cancelled: readonly CancelledBooking[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const b of cancelled) {
    counts.set(b.user_id, (counts.get(b.user_id) ?? 0) + 1)
  }
  return counts
}
