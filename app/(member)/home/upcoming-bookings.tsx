import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CancelBookingButton } from "@/components/member/cancel-booking-button"
import {
  RescheduleDialog,
  type CandidateSession,
} from "@/components/member/reschedule-dialog"
import { formatStudio } from "@/lib/booking/format"
import { isCancellable, nextSevenDays, isUnlocked } from "@/lib/booking/rules"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type ClassRow = Database["public"]["Tables"]["classes"]["Row"]

export type UpcomingBooking = BookingRow & {
  sessions:
    | (Pick<SessionRow, "id" | "start_at" | "end_at"> & {
        classes: Pick<ClassRow, "name_ro"> | null
      })
    | null
}

export async function UpcomingBookings({
  bookings,
}: {
  bookings: UpcomingBooking[]
}) {
  const t = await getTranslations("home")

  // Pre-fetch candidate sessions for the reschedule dialog so it doesn't have
  // to do its own round-trip when opened. Only sessions in the next 7 days,
  // already unlocked, in the future, and not one of the user's current
  // booking sessions.
  const supabase = await createClient()
  const days = nextSevenDays()
  const firstDay = days[0]!
  const lastDay = days[days.length - 1]!
  const myBookedSessionIds = new Set(
    bookings.map((b) => b.sessions?.id).filter(Boolean) as string[],
  )

  const { data: rawCandidates } = await supabase
    .from("sessions")
    .select(
      "id, session_date, start_at, capacity, booked_count, unlock_at, classes(name_ro)",
    )
    .gte("session_date", firstDay)
    .lte("session_date", lastDay)
    .order("start_at", { ascending: true })

  const now = new Date()
  const candidates: CandidateSession[] = (rawCandidates ?? [])
    .filter(
      (s) =>
        !myBookedSessionIds.has(s.id) &&
        new Date(s.start_at).getTime() > now.getTime() &&
        isUnlocked(s.unlock_at, now),
    )
    .map((s) => ({
      id: s.id,
      session_date: s.session_date,
      start_at: s.start_at,
      spots_left: Math.max(s.capacity - s.booked_count, 0),
      full: s.capacity - s.booked_count <= 0,
      class_name: s.classes?.name_ro ?? null,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("upcomingBookings")}</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noUpcomingBookings")}
          </p>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const session = b.sessions
              if (!session) return null
              const cancellable = isCancellable(session.start_at)
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {session.classes?.name_ro ?? "Sesiune"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatStudio(session.start_at, "EEEE d MMM, HH:mm")}
                    </p>
                  </div>
                  {cancellable ? (
                    <div className="flex gap-2">
                      <RescheduleDialog
                        bookingId={b.id}
                        candidates={candidates}
                      />
                      <CancelBookingButton bookingId={b.id} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("locked")}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
