import { addDays, formatISO, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import TrainerBadge from "@/components/trainer-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { studioDateISO } from "@/lib/booking/rules"
import { trainerColors } from "@/lib/constants"
import { isCalendarConfigured } from "@/lib/google/config"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { SyncCalendarButton } from "./sync-calendar-button"

/** Days ahead of today (today included) the admin can open. */
const VIEW_DAYS = 14
/** Days before today the admin can look back at. */
const PAST_DAYS = 60

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// The calendar sync action invoked from this page pushes events to Google
// Calendar via `after()`; give it room beyond the default 10s.
export const maxDuration = 60

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const supabase = await createClient()
  const t = await getTranslations("adminSessions")
  const sp = await searchParams

  // One day at a time, anywhere from PAST_DAYS back to VIEW_DAYS - 1 ahead
  // (studio dates). YYYY-MM-DD strings compare chronologically.
  const today = studioDateISO()
  const shift = (iso: string, n: number) =>
    formatISO(addDays(parseISO(iso), n), { representation: "date" })
  const minDay = shift(today, -PAST_DAYS)
  const maxDay = shift(today, VIEW_DAYS - 1)
  const requested = sp.day && DAY_RE.test(sp.day) ? sp.day : today
  const day =
    requested < minDay ? minDay : requested > maxDay ? maxDay : requested
  const prevDay = day > minDay ? shift(day, -1) : null
  const nextDay = day < maxDay ? shift(day, 1) : null

  const { data: sessions } = await supabase
    .from("sessions")
    .select(
      "id, session_date, start_at, capacity, booked_count, trainer, classes(name_ro), bookings(id, status, profiles(full_name, email))",
    )
    .eq("session_date", day)
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

  const list = sessions ?? []
  const navClass = cn(buttonVariants({ variant: "outline", size: "icon" }))
  const navDisabledClass = cn(navClass, "pointer-events-none opacity-50")

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { days: VIEW_DAYS, past: PAST_DAYS })}
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

      <nav
        aria-label={t("dayNav")}
        className="flex items-center justify-between gap-2"
      >
        {prevDay ? (
          <Link
            href={`/admin/sessions?day=${prevDay}`}
            className={navClass}
            aria-label={t("previousDay")}
            title={t("previousDay")}
          >
            <ChevronLeft className="size-4" />
          </Link>
        ) : (
          <span className={navDisabledClass} aria-hidden>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <div className="text-center">
          <p className="font-medium capitalize">
            {formatStudio(parseISO(day), "EEEE d MMM yyyy")}
          </p>
          <p className="text-xs text-muted-foreground">
            {day === today ? (
              t("today")
            ) : (
              <>
                {day < today ? `${t("pastDay")} · ` : null}
                <Link href="/admin/sessions" className="underline">
                  {t("backToToday")}
                </Link>
              </>
            )}
          </p>
        </div>
        {nextDay ? (
          <Link
            href={`/admin/sessions?day=${nextDay}`}
            className={navClass}
            aria-label={t("nextDay")}
            title={t("nextDay")}
          >
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={navDisabledClass} aria-hidden>
            <ChevronRight className="size-4" />
          </span>
        )}
      </nav>

      <form
        method="get"
        action="/admin/sessions"
        className="flex items-center justify-center gap-2"
      >
        <label htmlFor="day" className="sr-only">
          {t("pickDay")}
        </label>
        <input
          id="day"
          name="day"
          type="date"
          min={minDay}
          max={maxDay}
          defaultValue={day}
          className="h-9 rounded border bg-background px-2 text-sm"
        />
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {t("goToDay")}
        </button>
      </form>

      <Card>
        <CardHeader>
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
                  <li
                    key={s.id}
                    className={`rounded border border-l-4 p-3 ${
                      trainerColors(s.trainer).accent
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {formatStudio(s.start_at, "HH:mm")}
                        </p>
                        {s.trainer ? (
                          <TrainerBadge trainer={s.trainer} />
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
    </div>
  )
}
