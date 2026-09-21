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

      <div className="grid gap-3 sm:grid-cols-2">
        {(tiers ?? []).map((tier) => {
          const totalSessions = tier.sessions_per_month * tier.duration_months
          const price = Number(
            sex === "female" ? tier.price_female_ron : tier.price_male_ron,
          )
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
                <p className="text-2xl font-semibold">
                  {price.toLocaleString("ro-RO")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    RON
                  </span>
                </p>
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
