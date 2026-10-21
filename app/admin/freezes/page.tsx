import { formatISO, startOfDay } from "date-fns"
import { toZonedTime } from "date-fns-tz"
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
import { STUDIO_TZ } from "@/lib/booking/rules"
import { RULES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

import AllocateFreezeForm from "./allocate-freeze-form"
import RemainingDaysForm from "./remaining-days-form"

export default async function AdminFreezesPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminFreezes")

  const today = formatISO(startOfDay(toZonedTime(new Date(), STUDIO_TZ)), {
    representation: "date",
  })

  const [{ data: freezes }, { data: overview }] = await Promise.all([
    supabase
      .from("freeze_periods")
      .select("id, user_id, start_date, end_date, duration_days, profiles(full_name, email)")
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    supabase.rpc("admin_freeze_overview"),
  ])

  const active = (freezes ?? []).filter((f) => f.start_date <= today)
  const upcoming = (freezes ?? []).filter((f) => f.start_date > today)
  const members = (overview ?? []).map((m) => ({
    id: m.user_id,
    label: m.full_name ?? m.email,
    remainingDays: m.remaining_days,
  }))

  const freezeList = (rows: typeof active, empty: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y">
        {rows.map((f) => (
          <li
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <Link
              href={`/admin/users/${f.user_id}`}
              className="font-medium hover:underline"
            >
              {f.profiles?.full_name ?? f.profiles?.email}
            </Link>
            <span className="text-muted-foreground">
              {formatStudio(new Date(f.start_date), "d MMM")} →{" "}
              {formatStudio(new Date(f.end_date), "d MMM yyyy")} ·{" "}
              {t("daysCount", { days: f.duration_days ?? 0 })}
            </span>
          </li>
        ))}
      </ul>
    )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", { total: RULES.FREEZE_TOTAL_DAYS_PER_6_MONTHS })}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("activeTitle", { count: active.length })}</CardTitle>
        </CardHeader>
        <CardContent>{freezeList(active, t("noActive"))}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("upcomingTitle", { count: upcoming.length })}</CardTitle>
        </CardHeader>
        <CardContent>{freezeList(upcoming, t("noUpcoming"))}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("allocateTitle")}</CardTitle>
          <CardDescription>{t("allocateDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          ) : (
            <AllocateFreezeForm members={members} today={today} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("remainingTitle")}</CardTitle>
          <CardDescription>{t("remainingDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {(overview ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
          ) : (
            <ul className="divide-y">
              {(overview ?? []).map((m) => (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${m.user_id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {m.full_name ?? m.email}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t("daysLeft", { days: m.remaining_days })}
                      {m.override_expires_on
                        ? ` · ${t("overrideUntil", {
                            date: formatStudio(
                              new Date(m.override_expires_on),
                              "d MMM yyyy",
                            ),
                          })}`
                        : ""}
                    </p>
                  </div>
                  <RemainingDaysForm
                    userId={m.user_id}
                    remainingDays={m.remaining_days}
                    hasOverride={m.override_expires_on !== null}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
