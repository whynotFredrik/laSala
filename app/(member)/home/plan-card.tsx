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
      </CardContent>
    </Card>
  )
}
