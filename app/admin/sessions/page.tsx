import { addDays, formatISO, startOfDay } from "date-fns"
import { toZonedTime } from "date-fns-tz"
import { ExternalLink } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import { isCalendarConfigured } from "@/lib/google/config"
import { createClient } from "@/lib/supabase/server"

import { SyncCalendarButton } from "./sync-calendar-button"

const VIEW_DAYS = 14

// The calendar sync action invoked from this page pushes events to Google
// Calendar via `after()`; give it room beyond the default 10s.
export const maxDuration = 60

/**
 * Per-trainer chip colors so the admin can scan a busy day and tell at a
 * glance whose slot is whose. Keep these in sync with any future trainer
 * additions.
 */
const TRAINER_BADGE: Record<string, string> = {
  Eugen:
    "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  Marina:
    "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-200",
  Ana:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
}

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
      "id, session_date, start_at, capacity, booked_count, trainer, classes(name_ro), bookings(id, status, profiles(full_name, email))",
    )
    .gte("session_date", start)
    .lte("session_date", end)
    .order("start_at", { ascending: true })
    .order("trainer", { ascending: true })

  // Google Calendar sync state for the sessions on screen (admin RLS read).
  const calendarOn = isCalendarConfigured()
  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: calendarRows } =
    calendarOn && sessionIds.length > 0
      ? await supabase
          .from("calendar_events")
          .select("session_id, html_link, last_error")
          .in("session_id", sessionIds)
      : { data: [] }
  const calendarBySession = new Map(
    (calendarRows ?? []).map((r) => [r.session_id, r]),
  )
  const calendarErrors = (calendarRows ?? []).filter((r) => r.last_error)

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
        <div className="flex flex-wrap gap-2">
          {calendarOn ? <SyncCalendarButton /> : null}
        </div>
      </header>

      {calendarErrors.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{t("calendarErrorsTitle")}</AlertTitle>
          <AlertDescription>
            {t("calendarErrors", {
              count: calendarErrors.length,
              message: calendarErrors[0].last_error ?? "",
            })}
          </AlertDescription>
        </Alert>
      ) : null}

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
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {formatStudio(s.start_at, "HH:mm")}
                            </p>
                            {s.trainer ? (
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  TRAINER_BADGE[s.trainer] ??
                                  "bg-muted text-muted-foreground"
                                }`}
                              >
                                {s.trainer}
                              </span>
                            ) : (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {t("noTrainer")}
                              </span>
                            )}
                            {s.classes?.name_ro ? (
                              <span className="text-sm text-muted-foreground">
                                · {s.classes.name_ro}
                              </span>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              · {s.booked_count}/{s.capacity} {t("booked")}
                            </span>
                          </div>
                          {calendarBySession.get(s.id)?.html_link ? (
                            <a
                              href={calendarBySession.get(s.id)?.html_link ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              title={t("openInCalendar")}
                              aria-label={t("openInCalendar")}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          ) : null}
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
