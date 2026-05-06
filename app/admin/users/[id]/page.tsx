import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { AdjustPlanForm } from "./adjust-plan-form"

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const t = await getTranslations("adminUsers")

  const [
    { data: profile },
    { data: activePlan },
    { data: dietary },
    { data: recentBookings },
    { data: pendingRequests },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("plans")
      .select("*, plan_tiers(name_ro)")
      .eq("user_id", id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("dietary_questionnaires")
      .select("*")
      .eq("user_id", id)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, status, booked_at, sessions(start_at, classes(name_ro))",
      )
      .eq("user_id", id)
      .order("booked_at", { ascending: false })
      .limit(10),
    supabase
      .from("plan_requests")
      .select("id, tier_id, plan_tiers(name_ro), status, created_at")
      .eq("user_id", id)
      .eq("status", "pending"),
  ])

  if (!profile) notFound()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile.full_name ?? profile.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.email}
          {profile.phone ? ` · ${profile.phone}` : ""}
          {" · "}
          {profile.role}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("activePlan")}</CardTitle>
          <CardDescription>
            {activePlan
              ? activePlan.plan_tiers?.name_ro ?? activePlan.id
              : t("noActivePlan")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activePlan ? (
            <AdjustPlanForm
              planId={activePlan.id}
              sessionsTotal={activePlan.sessions_total}
              sessionsUsed={activePlan.sessions_used}
              endDate={activePlan.end_date}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("approveRequestHint")}
            </p>
          )}
        </CardContent>
      </Card>

      {pendingRequests && pendingRequests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("pendingRequests")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {pendingRequests.map((r) => (
                <li key={r.id}>
                  {r.plan_tiers?.name_ro ?? r.tier_id}
                  {" · "}
                  {format(new Date(r.created_at), "d MMM yyyy", { locale: ro })}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("recentBookings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentBookings || recentBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBookings")}</p>
          ) : (
            <ul className="divide-y text-sm">
              {recentBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>
                    {b.sessions?.classes?.name_ro ?? "Sesiune"} ·{" "}
                    {b.sessions?.start_at
                      ? format(
                          new Date(b.sessions.start_at),
                          "EEEE d MMM, HH:mm",
                          { locale: ro },
                        )
                      : ""}
                  </span>
                  <span className="text-muted-foreground">{b.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dietary")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!dietary ? (
            <p className="text-muted-foreground">{t("noQuestionnaire")}</p>
          ) : (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs">
              {JSON.stringify(dietary, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
