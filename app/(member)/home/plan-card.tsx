import Link from "next/link"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import type { PlanWithTier } from "@/lib/plans/active"
import {
  isRenewalOnTime,
  nextStreakMonth,
  streakDiscountRon,
} from "@/lib/plans/streak"

export async function PlanCard({ plan }: { plan: PlanWithTier | null }) {
  const t = await getTranslations("home")

  if (!plan) {
    return (
      <Alert>
        <AlertTitle>{t("noActivePlan")}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{t("noActivePlanBody")}</span>
          <Link href="/plans" className={buttonVariants({ size: "sm" })}>
            {t("choosePlan")}
          </Link>
        </AlertDescription>
      </Alert>
    )
  }

  const remaining = Math.max(plan.sessions_total - plan.sessions_used, 0)
  const expired = new Date(plan.end_date) < new Date()
  const exhausted = remaining === 0
  // Nothing left on this plan: the member has to renew before the next
  // booking.
  const needsRenewal = expired || exhausted

  // Consistency streak: where the member stands and what paying the next
  // plan on time gets them. Discount applies to monthly tiers only.
  const onTime = isRenewalOnTime(plan.end_date)
  const nextStreak = nextStreakMonth(plan)
  const nextDiscount =
    plan.plan_tiers?.category === "monthly" ? streakDiscountRon(nextStreak) : 0
  const deadline = format(new Date(plan.end_date), "d MMMM", { locale: ro })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {plan.plan_tiers?.name_ro ?? "Plan"}
        </CardTitle>
        <CardDescription>{t("yourPlan")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="text-2xl font-semibold">
          {remaining}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {t("sessionsRemaining")}
          </span>
        </p>
        <p className="text-muted-foreground">
          {expired ? t("planExpired") : `${t("planExpires")} `}
          <span className="font-medium text-foreground">
            {format(new Date(plan.end_date), "d MMM yyyy", { locale: ro })}
          </span>
        </p>
        <div className="mt-3 space-y-0.5 rounded border bg-muted/40 p-2 text-xs">
          <p className="font-medium">
            {t("streakTitle", { month: plan.streak_month })}
          </p>
          <p className="text-muted-foreground">
            {!onTime
              ? t("streakLost")
              : nextDiscount > 0
                ? t("streakNextDiscount", {
                    date: deadline,
                    month: nextStreak,
                    discount: nextDiscount,
                  })
                : t("streakNext", { date: deadline, month: nextStreak })}
          </p>
        </div>
        {needsRenewal ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">{t("needsRenewalTitle")}</p>
            <p>{t("needsRenewalBody")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
