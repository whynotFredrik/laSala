import { addDays, formatISO } from "date-fns"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
      "id, created_at, status, notes, preferred_payment_method, user_id, plan_tiers(name_ro, category, price_male_ron, price_female_ron), profiles!user_id(full_name, email, sex)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  // The streak decision needs each requester's current active plan (and
  // whether a renewal is already queued). One query for all of them.
  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))]
  const { data: plans } = userIds.length
    ? await supabase
        .from("plans")
        .select("user_id, streak_month, end_date, is_active, is_scheduled")
        .in("user_id", userIds)
        .or("is_active.eq.true,is_scheduled.eq.true")
    : { data: [] }

  const activeByUser = new Map(
    (plans ?? []).filter((p) => p.is_active).map((p) => [p.user_id, p]),
  )
  const scheduledUsers = new Set(
    (plans ?? []).filter((p) => p.is_scheduled).map((p) => p.user_id),
  )

  const list = (requests ?? []).map((r) => {
    const sex = r.profiles?.sex as "male" | "female" | null
    const price = r.plan_tiers
      ? Number(
          sex === "female"
            ? r.plan_tiers.price_female_ron
            : r.plan_tiers.price_male_ron,
        )
      : 0
    const activePlan = activeByUser.get(r.user_id) ?? null
    // "Approving right now" perspective: on-time renewal continues the
    // streak and (for monthly tiers) applies the discount. Mirrors
    // `approve_plan_request` in 0018.
    const onTime = !!activePlan && isRenewalOnTime(activePlan.end_date)
    const streakMonth = nextStreakMonth(activePlan)
    const discount =
      r.plan_tiers?.category === "monthly" ? streakDiscountRon(streakMonth) : 0
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
      streak: {
        month: streakMonth,
        discount_ron: discount,
        price_due_ron: Math.max(price - discount, 0),
        // On-time renewals start the day after the current plan ends — the
        // Postgres function forces this, so show it instead of a date input.
        forced_start_date:
          onTime && activePlan
            ? formatISO(addDays(new Date(activePlan.end_date), 1), {
                representation: "date",
              })
            : null,
        has_scheduled: scheduledUsers.has(r.user_id),
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
