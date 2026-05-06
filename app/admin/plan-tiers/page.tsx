import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { TierRow, type Tier } from "./tier-row"

export default async function AdminPlanTiersPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminPlanTiers")

  const { data: tiers } = await supabase
    .from("plan_tiers")
    .select(
      "id, code, name_ro, name_en, category, sessions_per_month, duration_months, price_ron, display_order, is_active",
    )
    .order("display_order", { ascending: true })

  const list = (tiers ?? []) as Tier[]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t("editTitle")}</CardTitle>
          <CardDescription>{t("editDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {list.map((tier) => (
              <TierRow key={tier.id} tier={tier} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
