import Link from "next/link"
import { addDays, formatISO } from "date-fns"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatStudio } from "@/lib/booking/format"
import { studioDateISO, studioWeekStart } from "@/lib/booking/rules"
import { remainingSessions } from "@/lib/plans/rules"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

/**
 * Members whose active plan ends in a given studio week (Mon..Sun,
 * Europe/Bucharest). `?week=1` shows next week, `?week=-1` last week.
 * Grouped by end date so the studio can plan who to talk to each day.
 */
export default async function ExpiringThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const supabase = await createClient()
  const t = await getTranslations("adminExpiring")
  const { week } = await searchParams
  const offset = Math.max(-8, Math.min(8, Number.parseInt(week ?? "0", 10) || 0))

  const monday = addDays(studioWeekStart(new Date()), offset * 7)
  const sunday = addDays(monday, 6)
  const from = formatISO(monday, { representation: "date" })
  const to = formatISO(sunday, { representation: "date" })
  const today = studioDateISO()

  const { data: plans } = await supabase
    .from("plans")
    .select(
      "id, user_id, end_date, sessions_total, sessions_used, streak_month, plan_tiers(name_ro, category), profiles!plans_user_id_fkey(full_name, email, phone)",
    )
    .eq("status", "active")
    .gte("end_date", from)
    .lte("end_date", to)
    .order("end_date", { ascending: true })

  // Pending renewal requests for these members — already on it.
  const userIds = Array.from(new Set((plans ?? []).map((p) => p.user_id)))
  const { data: pending } =
    userIds.length > 0
      ? await supabase
          .from("plan_requests")
          .select("user_id")
          .in("user_id", userIds)
          .eq("status", "pending")
      : { data: [] }
  const hasPending = new Set((pending ?? []).map((r) => r.user_id))

  const byDay = new Map<string, NonNullable<typeof plans>>()
  for (let i = 0; i < 7; i++) {
    byDay.set(formatISO(addDays(monday, i), { representation: "date" }), [])
  }
  for (const p of plans ?? []) byDay.get(p.end_date)?.push(p)

  const weekLabel = `${formatStudio(monday, "d MMM")} – ${formatStudio(sunday, "d MMM yyyy")}`
  const total = plans?.length ?? 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { week: weekLabel, count: total })}
          </p>
        </div>
        <nav className="flex gap-2">
          <Link
            href={`/admin/expiring?week=${offset - 1}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← {t("prevWeek")}
          </Link>
          {offset !== 0 ? (
            <Link
              href="/admin/expiring"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("thisWeek")}
            </Link>
          ) : null}
          <Link
            href={`/admin/expiring?week=${offset + 1}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("nextWeek")} →
          </Link>
        </nav>
      </header>

      {total === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("none")}
          </CardContent>
        </Card>
      ) : (
        Array.from(byDay.entries()).map(([day, list]) => {
          if (list.length === 0) return null
          const isPast = day < today
          return (
            <Card key={day} className={cn(isPast && "opacity-70")}>
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {formatStudio(new Date(`${day}T12:00:00`), "EEEE d MMMM")}
                  {day === today ? ` · ${t("today")}` : ""}
                </CardTitle>
                <CardDescription>
                  {t("countForDay", { count: list.length })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {list.map((p) => {
                    const remaining = remainingSessions(p)
                    const monthly = p.plan_tiers?.category === "monthly"
                    return (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/admin/users/${p.user_id}`}
                            className="font-medium hover:underline"
                          >
                            {p.profiles?.full_name ?? p.profiles?.email}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {p.profiles?.email}
                            {p.profiles?.phone ? ` · ${p.profiles.phone}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-muted px-2 py-0.5">
                            {p.plan_tiers?.name_ro ?? "—"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5",
                              remaining === 0
                                ? "bg-muted text-muted-foreground"
                                : "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
                            )}
                          >
                            {t("sessionsLeft", { count: remaining })}
                          </span>
                          {monthly ? (
                            <span className="rounded-full bg-muted px-2 py-0.5">
                              {t("streak", { month: p.streak_month })}
                            </span>
                          ) : null}
                          {hasPending.has(p.user_id) ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                              {t("requestPending")}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
