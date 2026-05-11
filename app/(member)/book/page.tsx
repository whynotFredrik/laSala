import { isAfter, parseISO } from "date-fns"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BookButton } from "@/components/member/book-button"
import { formatStudio } from "@/lib/booking/format"
import { nextSevenDays, isUnlocked } from "@/lib/booking/rules"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type ClassRow = Database["public"]["Tables"]["classes"]["Row"]

type SessionWithClass = SessionRow & {
  classes: Pick<ClassRow, "name_ro" | "color"> | null
}

export default async function BookPage() {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("booking")

  const days = nextSevenDays()
  const firstDay = days[0]!
  const lastDay = days[days.length - 1]!

  // Pull every session in the 7-day window. We filter to either the
  // member's assigned trainer OR sessions with no trainer assigned (legacy
  // open sessions) so a member only sees their trainer's lineup.
  const trainer = profile.trainer
  let sessionsQuery = supabase
    .from("sessions")
    .select("*, classes(name_ro, color)")
    .gte("session_date", firstDay)
    .lte("session_date", lastDay)
    .order("start_at", { ascending: true })

  if (trainer) {
    sessionsQuery = sessionsQuery.or(`trainer.eq.${trainer},trainer.is.null`)
  }

  const { data: sessionsRaw } = await sessionsQuery

  // The user's currently-booked session ids — used to disable those buttons.
  const { data: myBookings } = await supabase
    .from("bookings")
    .select("session_id")
    .eq("user_id", user.id)
    .eq("status", "booked")

  const bookedIds = new Set((myBookings ?? []).map((b) => b.session_id))
  const sessions = (sessionsRaw ?? []) as SessionWithClass[]

  const byDay = new Map<string, SessionWithClass[]>()
  for (const day of days) byDay.set(day, [])
  for (const s of sessions) {
    byDay.get(s.session_date)?.push(s)
  }

  const now = new Date()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("availableSessions")}
        </h1>
      </header>

      {days.map((day) => {
        const list = byDay.get(day) ?? []
        const date = parseISO(day)
        // Day heading is a calendar date (no TZ), so date-fns is fine here.
        const heading = formatStudio(date, "EEEE, d MMMM")

        return (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="capitalize">{heading}</CardTitle>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noSessionsForDay")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {list.map((s) => {
                    const start = new Date(s.start_at)
                    const spotsLeft = Math.max(s.capacity - s.booked_count, 0)
                    const unlocked = isUnlocked(s.unlock_at, now)
                    const inPast = !isAfter(start, now)
                    const alreadyBooked = bookedIds.has(s.id)
                    const full = spotsLeft === 0

                    let label = t("bookSession")
                    let disabled = false

                    if (alreadyBooked) {
                      label = t("booked")
                      disabled = true
                    } else if (inPast) {
                      label = t("inPast")
                      disabled = true
                    } else if (!unlocked) {
                      label = t("locksUntilSunday")
                      disabled = true
                    } else if (full) {
                      label = t("full")
                      disabled = true
                    }

                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 rounded border p-3"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium">
                            {formatStudio(start, "HH:mm")}
                            {s.classes?.name_ro
                              ? ` · ${s.classes.name_ro}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {full
                              ? t("full")
                              : `${spotsLeft} ${t("spotsLeft")}`}
                          </p>
                        </div>
                        <BookButton
                          sessionId={s.id}
                          disabled={disabled}
                          label={label}
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}

      <Alert>
        <AlertTitle>{t("rulesTitle")}</AlertTitle>
        <AlertDescription>{t("rulesBody")}</AlertDescription>
      </Alert>
    </div>
  )
}
