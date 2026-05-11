import { addDays, formatISO, startOfDay } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import { createClient } from "@/lib/supabase/server"

import { GenerateNextWeekButton } from "./generate-button"

const VIEW_DAYS = 14

export default async function AdminSessionsPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminSessions")

  const todayLocal = startOfDay(toZonedTime(new Date(), STUDIO_TZ))
  const start = formatISO(todayLocal, { representation: "date" })
  const end = formatISO(addDays(todayLocal, VIEW_DAYS - 1), {
    representation: "date",
  })

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, session_date, start_at, capacity, booked_count, classes(name_ro), bookings(id, status, profiles(full_name, email))",
    )
    .gte("session_date", start)
    .lte("session_date", end)
    .order("start_at", { ascending: true })

  // Group by session_date.
  const days = Array.from({ length: VIEW_DAYS }, (_, i) =>
    formatISO(addDays(todayLocal, i), { representation: "date" }),
  )
  const byDay = new Map<string, typeof sessions>()
  for (const d of days) byDay.set(d, [])
  for (const s of sessions ?? []) byDay.get(s.session_date)?.push(s)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { days: VIEW_DAYS })}
          </p>
        </div>
        <GenerateNextWeekButton />
      </header>

      {days.map((day) => {
        const list = byDay.get(day) ?? []
        const date = new Date(day)
        return (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {formatStudio(date, "EEEE d MMM yyyy")}
              </CardTitle>
              <CardDescription>
                {list.length} {t("sessionsCount")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("noSessions")}
                </p>
              ) : (
                <ul className="space-y-3">
                  {list.map((s) => {
                    const roster =
                      (s.bookings ?? []).filter(
                        (b) => b.status === "booked",
                      ) ?? []
                    return (
                      <li key={s.id} className="rounded border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">
                              {formatStudio(s.start_at, "HH:mm")}
                              {s.classes?.name_ro
                                ? ` · ${s.classes.name_ro}`
                                : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.booked_count}/{s.capacity}{" "}
                              {t("booked")}
                            </p>
                          </div>
                        </div>
                        {roster.length > 0 ? (
                          <ul className="mt-2 space-y-0.5 text-sm">
                            {roster.map((b) => (
                              <li
                                key={b.id}
                                className="text-muted-foreground"
                              >
                                {b.profiles?.full_name ?? b.profiles?.email}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
