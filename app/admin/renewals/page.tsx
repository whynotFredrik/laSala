import { addDays, formatISO, parseISO } from "date-fns"
import { Phone } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { studioDateISO, studioWeekStart } from "@/lib/booking/rules"
import { RENEWAL_WATCH, renewalWatchFor } from "@/lib/plans/rules"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

/**
 * Members to talk to about their next plan: active plans with at most
 * `MAX_SESSIONS_LEFT` sessions left to book, or ending within
 * `EXPIRY_DAYS` (`renewalWatchFor`). Each row shows what the member still
 * has booked this studio week, so the admin can see when they will be in.
 */
export default async function AdminRenewalsPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminRenewals")

  const today = studioDateISO()
  const weekEnd = formatISO(addDays(studioWeekStart(), 6), {
    representation: "date",
  })

  const [{ data: plans }, { data: pending }] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "id, user_id, sessions_used, sessions_total, end_date, plan_tiers(name_ro), profiles(full_name, email, phone)",
      )
      .eq("status", "active"),
    supabase.from("plan_requests").select("user_id").eq("status", "pending"),
  ])

  const watched = (plans ?? [])
    .map((p) => ({ plan: p, watch: renewalWatchFor(p, today) }))
    .flatMap(({ plan, watch }) => (watch ? [{ plan, watch }] : []))
    .sort(
      (a, b) =>
        a.watch.daysLeft - b.watch.daysLeft ||
        a.watch.remaining - b.watch.remaining,
    )

  // Every upcoming booking of those members: this week's are listed, and
  // the last one is "the last session" once nothing is left to book.
  const userIds = watched.map((w) => w.plan.user_id)
  const { data: bookings } =
    userIds.length > 0
      ? await supabase
          .from("bookings")
          .select("user_id, sessions!inner(start_at, session_date)")
          .eq("status", "booked")
          .in("user_id", userIds)
          .gte("sessions.start_at", new Date().toISOString())
          .order("start_at", { referencedTable: "sessions", ascending: true })
      : { data: [] }

  const upcomingByUser = new Map<string, { startAt: string; date: string }[]>()
  for (const b of bookings ?? []) {
    if (!b.sessions) continue
    const list = upcomingByUser.get(b.user_id) ?? []
    list.push({ startAt: b.sessions.start_at, date: b.sessions.session_date })
    upcomingByUser.set(b.user_id, list)
  }
  for (const list of upcomingByUser.values()) {
    list.sort((a, b) => a.startAt.localeCompare(b.startAt))
  }
  const pendingUsers = new Set((pending ?? []).map((r) => r.user_id))

  const lowCount = watched.filter((w) => w.watch.lowSessions).length
  const expiringCount = watched.filter((w) => w.watch.expiringSoon).length

  const expiryText = (daysLeft: number) =>
    daysLeft < 0
      ? t("expired")
      : daysLeft === 0
        ? t("expiresToday")
        : t("expiresIn", { days: daysLeft })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", {
            sessions: RENEWAL_WATCH.MAX_SESSIONS_LEFT,
            days: RENEWAL_WATCH.EXPIRY_DAYS,
          })}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {t("lowSessionsCount", {
                sessions: RENEWAL_WATCH.MAX_SESSIONS_LEFT,
              })}
            </CardDescription>
            <CardTitle className="text-3xl">{lowCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              {t("expiringCount", { days: RENEWAL_WATCH.EXPIRY_DAYS })}
            </CardDescription>
            <CardTitle className="text-3xl">{expiringCount}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle", { count: watched.length })}</CardTitle>
          <CardDescription>
            {t("weekRange", {
              from: formatStudio(parseISO(`${today}T12:00:00Z`), "EEEE d MMM"),
              to: formatStudio(parseISO(`${weekEnd}T12:00:00Z`), "EEEE d MMM"),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watched.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y">
              {watched.map(({ plan, watch }) => {
                const upcoming = upcomingByUser.get(plan.user_id) ?? []
                const thisWeek = upcoming.filter((u) => u.date <= weekEnd)
                const last = upcoming[upcoming.length - 1]
                const name =
                  plan.profiles?.full_name ?? plan.profiles?.email ?? "—"
                return (
                  <li key={plan.id} className="space-y-1.5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/admin/users/${plan.user_id}`}
                        className="font-medium hover:underline"
                      >
                        {name}
                      </Link>
                      {plan.profiles?.phone ? (
                        <a
                          href={`tel:${plan.profiles.phone}`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="size-3.5" />
                          {plan.profiles.phone}
                        </a>
                      ) : null}
                      {pendingUsers.has(plan.user_id) ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {t("requestPending")}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-muted-foreground">
                      {plan.plan_tiers?.name_ro ? (
                        <>{plan.plan_tiers.name_ro} · </>
                      ) : null}
                      <span
                        className={cn(
                          watch.lowSessions &&
                            "font-medium text-destructive",
                        )}
                      >
                        {t("sessionsLeft", {
                          remaining: watch.remaining,
                          total: plan.sessions_total,
                        })}
                      </span>
                      {" · "}
                      <span
                        className={cn(
                          watch.expiringSoon &&
                            "font-medium text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {t("endsOn", {
                          date: formatStudio(
                            parseISO(`${plan.end_date}T12:00:00Z`),
                            "d MMM yyyy",
                          ),
                        })}{" "}
                        ({expiryText(watch.daysLeft)})
                      </span>
                    </p>

                    <p>
                      <span className="text-muted-foreground">
                        {t("thisWeek")}{" "}
                      </span>
                      {thisWeek.length === 0
                        ? t("noBookingsThisWeek")
                        : thisWeek
                            .map((u) => formatStudio(u.startAt, "EEE d · HH:mm"))
                            .join(", ")}
                    </p>

                    {watch.remaining === 0 && last ? (
                      <p className="text-muted-foreground">
                        {t("lastSession", {
                          date: formatStudio(last.startAt, "EEEE d MMM · HH:mm"),
                        })}
                      </p>
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
