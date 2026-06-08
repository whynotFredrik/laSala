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
import { Alert, AlertTitle } from "@/components/ui/alert"
import type { Database } from "@/lib/supabase/database.types"

type PlanRow = Database["public"]["Tables"]["plans"]["Row"]
type TierRow = Database["public"]["Tables"]["plan_tiers"]["Row"]

export type ActivePlan =
  | (PlanRow & { plan_tiers: Pick<TierRow, "name_ro" | "name_en"> | null })
  | null

export async function PlanCard({ plan }: { plan: ActivePlan }) {
  const t = await getTranslations("home")

  if (!plan) {
    return (
      <Alert>
        <AlertTitle>{t("noActivePlan")}</AlertTitle>
      </Alert>
    )
  }

  const remaining = Math.max(plan.sessions_total - plan.sessions_used, 0)
  const expired = new Date(plan.end_date) < new Date()
  const exhausted = remaining === 0
  // When the regular plan can't cover the next session (exhausted OR expired),
  // grace bookings kick in. Show how many of the 2 grace credits are left.
  const onGrace = expired || exhausted
  const graceUsed = plan.grace_used ?? 0
  const graceRemaining = Math.max(2 - graceUsed, 0)

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
        {onGrace ? (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">{t("graceTitle")}</p>
            <p>{t("graceBody", { remaining: graceRemaining })}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
