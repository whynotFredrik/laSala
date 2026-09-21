"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/get-user"
import { reconcileCalendar, type SyncSummary } from "@/lib/google/sync"

/**
 * Manual full reconcile of the studio's Google Calendar (admin button).
 * `force` re-pushes every session in the window so events edited by hand
 * in Google are restored to what the app says.
 *
 * Session generation and recurring auto-bookings no longer have a manual
 * trigger — `/api/cron/daily-sync` keeps the current and next week in sync
 * every day (see `lib/sessions/ensure-week.ts`, `lib/booking/recurring.ts`).
 */
export async function syncCalendarAction(): Promise<SyncSummary> {
  await requireAdmin()
  const result = await reconcileCalendar({ force: true })
  revalidatePath("/admin/sessions")
  return result
}
