import { parseISO } from "date-fns"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { studioDateISO } from "@/lib/booking/rules"
import { createClient } from "@/lib/supabase/server"

import CloseDaysForm from "./close-days-form"
import ReopenDayButton from "./reopen-day-button"

// Closing days notifies (and emails) every member whose plan it extends,
// one at a time after the response; give the action room to finish.
export const maxDuration = 60

/**
 * Studio closures (holidays): pick days on a calendar to close the studio,
 * see the upcoming closed days and reopen one. Rules live in migration
 * 0036 (`admin_close_studio_days`, `admin_reopen_studio_day`); 0037 makes
 * closing extend active plans and reopening take the extension back.
 */
export default async function AdminClosuresPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminClosures")
  const today = studioDateISO()

  const { data: closures } = await supabase
    .from("studio_closures")
    .select("closed_on, reason")
    .gte("closed_on", today)
    .order("closed_on", { ascending: true })

  const upcoming = closures ?? []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("closeTitle")}</CardTitle>
          <CardDescription>{t("closeDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CloseDaysForm
            today={today}
            closedDates={upcoming.map((c) => c.closed_on)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("upcomingTitle", { count: upcoming.length })}
          </CardTitle>
          <CardDescription>{t("upcomingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((c) => {
                // Calendar date: format the date itself, no TZ shift.
                const label = formatStudio(
                  parseISO(`${c.closed_on}T12:00:00Z`),
                  "EEEE, d MMMM yyyy",
                )
                return (
                  <li
                    key={c.closed_on}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium first-letter:uppercase">{label}</p>
                      {c.reason ? (
                        <p className="text-muted-foreground">{c.reason}</p>
                      ) : null}
                    </div>
                    <ReopenDayButton date={c.closed_on} label={label} />
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
