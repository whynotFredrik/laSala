import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { PayInfoCard } from "./pay-info-card"
import { RequestPlanButton } from "./request-plan-button"

export default async function PlansPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("plans")

  const [{ data: tiers }, { data: pending }, { data: active }] =
    await Promise.all([
      supabase
        .from("plan_tiers")
        .select(
          "id, code, name_ro, category, sessions_per_month, duration_months, price_ron",
        )
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("plan_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ])

  const hasPending = !!pending
  const hasActive = !!active

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(tiers ?? []).map((tier) => {
          const totalSessions =
            tier.sessions_per_month * tier.duration_months
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
                  {tier.price_ron.toLocaleString("ro-RO")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    RON
                  </span>
                </p>
                <RequestPlanButton
                  tierId={tier.id}
                  hasPending={hasPending}
                  hasActive={hasActive}
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
