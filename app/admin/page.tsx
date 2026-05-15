import { startOfMonth } from "date-fns"
import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { enterMemberPreviewAction } from "./actions"

export default async function AdminDashboard() {
  const supabase = await createClient()
  const t = await getTranslations("adminDashboard")

  const monthStart = startOfMonth(new Date()).toISOString()
  const todayIso = new Date().toISOString().slice(0, 10)

  // count: 'exact', head: true returns just the number, no rows.
  const [
    { count: members },
    { count: activePlans },
    { count: bookingsThisMonth },
    { count: activeFreezes },
    { count: pendingRequests },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "member"),
    supabase
      .from("plans")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("booked_at", monthStart),
    supabase
      .from("freeze_periods")
      .select("id", { count: "exact", head: true })
      .lte("start_date", todayIso)
      .gte("end_date", todayIso),
    supabase
      .from("plan_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ])

  const stats = [
    { key: "members", value: members ?? 0 },
    { key: "activePlans", value: activePlans ?? 0 },
    { key: "bookingsThisMonth", value: bookingsThisMonth ?? 0 },
    { key: "activeFreezes", value: activeFreezes ?? 0 },
    { key: "pendingRequests", value: pendingRequests ?? 0 },
  ] as const

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <form action={enterMemberPreviewAction}>
          <Button type="submit" variant="outline" size="sm">
            {t("enterMemberPreview")}
          </Button>
        </form>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardDescription>{t(s.key)}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </div>
  )
}
