import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
      "id, created_at, status, notes, preferred_payment_method, plan_tiers(name_ro, price_ron), profiles!user_id(full_name, email)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  const list = (requests ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    notes: r.notes,
    preferred_payment_method: r.preferred_payment_method,
    profile: {
      full_name: r.profiles?.full_name ?? null,
      email: r.profiles?.email ?? "—",
    },
    tier: r.plan_tiers
      ? { name_ro: r.plan_tiers.name_ro, price_ron: Number(r.plan_tiers.price_ron) }
      : null,
  }))

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
