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
import { PlanQuoteSummary } from "@/components/member/plan-quote-summary"
import { BUSINESS } from "@/lib/constants"
import type { PendingRequest } from "@/lib/plans/pending"
import { quotePlan, type QuoteActivePlan } from "@/lib/plans/quote"

/**
 * "Request in progress" card: which plan the member asked for, how much
 * to pay at the studio (streak discount included, recomputed now so it
 * drops if they let the current plan expire) and what the plan will hold.
 */
export async function PendingRequestCard({
  request,
  sex,
  activePlan,
}: {
  request: PendingRequest
  sex: string | null
  activePlan: QuoteActivePlan | null
}) {
  const t = await getTranslations("pendingRequest")
  const tPlans = await getTranslations("plans")
  const tier = request.plan_tiers

  const method =
    request.preferred_payment_method === "pos"
      ? tPlans("posAtStudio")
      : request.preferred_payment_method === "cash"
        ? tPlans("cashAtStudio")
        : request.preferred_payment_method === "bank_transfer"
          ? tPlans("bankTransfer")
          : null

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("body", {
            plan: tier?.name_ro ?? t("unknownPlan"),
            date: format(new Date(request.created_at), "d MMMM", {
              locale: ro,
            }),
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {tier ? (
          <PlanQuoteSummary quote={quotePlan(tier, sex, activePlan)} />
        ) : null}
        <p className="text-muted-foreground">
          {t("howToPay", { address: BUSINESS.address })}
          {method ? ` ${t("preferredMethod", { method })}` : null}
        </p>
      </CardContent>
    </Card>
  )
}
