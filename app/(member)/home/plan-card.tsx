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
import type { PlanWithTier } from "@/lib/plans/active"

export async function PlanCard({
  plan,
  queued,
}: {
  plan: PlanWithTier | null
  queued: PlanWithTier | null
}) {
  const t = await getTranslations("home")

  if (!plan) {
    return (
      <Alert>
        <AlertTitle>{t("noActivePlan")}</AlertTitle>
        {queued ? (
          <AlertDescription>
            {t("nextPlanQueued", { name: queued.plan_tiers?.name_ro ?? "" })}
          </AlertDescription>
        ) : null}
      </Alert>
    )
  }

  const remaining = Math.max(plan.sessions_total - plan.sessions_used, 0)
  const expired = new Date(plan.end_date) < new Date()
  const exhausted = remaining === 0
  // Nothing left on this plan and nothing queued: the member has to renew
  // before the next booking.
  const needsRenewal = (expired || exhausted) && !queued

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
        {plan.streak_month > 1 ? (
          <p className="text-muted-foreground">
            {t("streakBadge", { month: plan.streak_month })}
          </p>
        ) : null}
        {queued ? (
          <p className="mt-3 rounded border bg-muted/40 p-2 text-xs">
            {t("nextPlanQueued", { name: queued.plan_tiers?.name_ro ?? "" })}
          </p>
        ) : null}
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
