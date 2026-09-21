import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { getMemberPlans } from "@/lib/plans/active"
import {
  isRenewalOnTime,
  nextStreakMonth,
  streakDiscountRon,
} from "@/lib/plans/streak"
import { createClient } from "@/lib/supabase/server"

import { PayInfoCard } from "./pay-info-card"
import { RequestPlanButton } from "./request-plan-button"

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>
}) {
  const { user, profile } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("plans")
  const { tier: highlightTier } = await searchParams

  const [{ data: tiers }, { data: pending }, { active, queued }] =
    await Promise.all([
      supabase
        .from("plan_tiers")
        .select(
          "id, code, name_ro, category, sessions_per_month, duration_months, price_male_ron, price_female_ron",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("plan_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
      getMemberPlans(supabase, user.id),
    ])

  const hasPending = !!pending
  const hasQueued = !!queued
  // Pick the price column for the member's sex. Falls back to male price
  // for the rare case a member's sex is somehow unset (legacy accounts).
  const sex = (profile.sex as "male" | "female" | null) ?? "male"

  // Streak: the month a renewal paid today would land on, and its discount.
  const onTime = !!active && isRenewalOnTime(active.end_date)
  const nextStreak = nextStreakMonth(active)
  const nextDiscount = streakDiscountRon(nextStreak)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {active ? t("subtitleRenew") : t("subtitle")}
        </p>
      </header>

      {queued ? (
        <Alert>
          <AlertTitle>
            {t("queuedTitle", { name: queued.plan_tiers?.name_ro ?? "" })}
          </AlertTitle>
          <AlertDescription>
            {active
              ? t("queuedBody", {
                  endDate: format(new Date(active.end_date), "d MMM yyyy", {
                    locale: ro,
                  }),
                })
              : t("queuedBodyNoActive")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("streakTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t("streakIntro")}</p>
          {queued ? (
            <p className="font-medium text-foreground">
              {t("streakQueued", { month: queued.streak_month })}
            </p>
          ) : onTime && active ? (
            <p className="font-medium text-foreground">
              {t("streakNext", {
                month: nextStreak,
                date: format(new Date(active.end_date), "d MMMM yyyy", {
                  locale: ro,
                }),
                discount: nextDiscount,
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {(tiers ?? []).map((tier) => {
          const totalSessions = tier.sessions_per_month * tier.duration_months
          const price = Number(
            sex === "female" ? tier.price_female_ron : tier.price_male_ron,
          )
          // Streak discount applies to monthly tiers only; 6-month promo
          // packages already have their discount baked into the price.
          const discount =
            tier.category === "monthly" && !queued ? nextDiscount : 0
          const finalPrice = Math.max(price - discount, 0)
          return (
            <Card key={tier.id}>
              <CardHeader>
                <CardTitle>{tier.name_ro}</CardTitle>
                <CardDescription>
                  {totalSessions} {t("sessionsTotal")} ·{" "}
                  {tier.duration_months}{" "}
                  {tier.duration_months === 1 ? t("month") : t("months")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-semibold">
                    {finalPrice.toLocaleString("ro-RO")}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      RON
                    </span>
                  </p>
                  {discount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="line-through">
                        {price.toLocaleString("ro-RO")} RON
                      </span>{" "}
                      · {t("streakDiscountBadge", { discount })}
                    </p>
                  ) : null}
                </div>
                <RequestPlanButton
                  tierId={tier.id}
                  hasPending={hasPending}
                  hasQueued={hasQueued}
                  isRenewal={!!active}
                  highlight={highlightTier === tier.id}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <PayInfoCard />
    </div>
  )
}
