import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { getActivePlan } from "@/lib/plans/active"
import {
  isRenewalOnTime,
  isStreakTier,
  nextStreakMonth,
  streakDiscountRon,
  toStreakRef,
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

  const [{ data: tiers }, { data: pending }, active] =
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
      getActivePlan(supabase, user.id),
    ])

  const hasPending = !!pending
  // Pick the price column for the member's sex. Falls back to male price
  // for the rare case a member's sex is somehow unset (legacy accounts).
  const sex = (profile.sex as "male" | "female" | null) ?? "male"

  // Streak: the month a monthly renewal paid today would land on, and its
  // discount. Only monthly → monthly counts; a member on a promotion has
  // no streak and starts at month 1 with their first monthly plan.
  const activeRef = toStreakRef(active)
  const onPromo = !!active && !isStreakTier(active.plan_tiers?.category)
  const onTime = !!active && isRenewalOnTime(active.end_date)
  const nextStreak = nextStreakMonth(activeRef, "monthly")
  const nextDiscount = streakDiscountRon(nextStreak)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {active ? t("subtitleRenew") : t("subtitle")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("streakTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t("streakIntro")}</p>
          {onPromo ? (
            <p className="font-medium text-foreground">{t("streakPromo")}</p>
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
          const discount = isStreakTier(tier.category) ? nextDiscount : 0
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
