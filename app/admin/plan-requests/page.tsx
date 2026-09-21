import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { addMonths, format } from "date-fns"

import { remainingSessions } from "@/lib/plans/rules"
import {
  isRenewalOnTime,
  nextStreakMonth,
  streakDiscountRon,
} from "@/lib/plans/streak"
import { createClient } from "@/lib/supabase/server"

import { RequestRow } from "./request-row"

export default async function PlanRequestsAdminPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminPlanRequests")

  // `plan_requests` has two FKs to `profiles` (user_id + approved_by) so
  // PostgREST needs the column name to know which relationship to embed.
  const { data: requests } = await supabase
    .from("plan_requests")
    .select(
      "id, user_id, created_at, status, notes, preferred_payment_method, plan_tiers(name_ro, category, duration_months, price_male_ron, price_female_ron), profiles!user_id(full_name, email, sex)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  // Each requester's active plan decides what approval does (same rule as
  // approve_plan_request): on time → merge (unused sessions carry over,
  // validity extends from the current end_date); otherwise a fresh start.
  const requesterIds = Array.from(
    new Set((requests ?? []).map((r) => r.user_id)),
  )
  const { data: plans } =
    requesterIds.length > 0
      ? await supabase
          .from("plans")
          .select("user_id, end_date, sessions_used, sessions_total, streak_month")
          .in("user_id", requesterIds)
          .eq("status", "active")
      : { data: [] }
  const activeByUser = new Map((plans ?? []).map((p) => [p.user_id, p]))

  const list = (requests ?? []).map((r) => {
    const sex = r.profiles?.sex as "male" | "female" | null
    const price = r.plan_tiers
      ? Number(
          sex === "female"
            ? r.plan_tiers.price_female_ron
            : r.plan_tiers.price_male_ron,
        )
      : 0
    // "Approving right now" perspective: on-time renewal continues the
    // streak and (for monthly tiers) applies the discount. Mirrors
    // `approve_plan_request` (0023).
    const activePlan = activeByUser.get(r.user_id) ?? null
    const onTime = !!activePlan && isRenewalOnTime(activePlan.end_date)
    const streakMonth = nextStreakMonth(activePlan)
    const discount =
      r.plan_tiers?.category === "monthly" ? streakDiscountRon(streakMonth) : 0
    const merge =
      onTime && activePlan && r.plan_tiers
        ? {
            remaining: remainingSessions(activePlan),
            newEndDate: format(
              addMonths(
                new Date(activePlan.end_date),
                r.plan_tiers.duration_months,
              ),
              "yyyy-MM-dd",
            ),
          }
        : null
    return {
      id: r.id,
      created_at: r.created_at,
      notes: r.notes,
      preferred_payment_method: r.preferred_payment_method,
      profile: {
        full_name: r.profiles?.full_name ?? null,
        email: r.profiles?.email ?? "—",
      },
      tier: r.plan_tiers
        ? { name_ro: r.plan_tiers.name_ro, price_ron: price }
        : null,
      merge,
      streak: {
        month: streakMonth,
        discount_ron: discount,
        price_due_ron: Math.max(price - discount, 0),
      },
    }
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {list.length} {t("pending")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPending")}</p>
          ) : (
            <ul className="space-y-3">
              {list.map((r) => (
                <RequestRow key={r.id} request={r} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
