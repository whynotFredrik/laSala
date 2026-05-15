import Link from "next/link"
import Image from "next/image"
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
import { buttonVariants } from "@/components/ui/button"
import { formatStudio } from "@/lib/booking/format"
import { createClient } from "@/lib/supabase/server"

import { AdjustPlanForm } from "./adjust-plan-form"
import { DietarySummary } from "./dietary-summary"
import { TrainerSelect } from "./trainer-select"

const SIGNED_URL_TTL_SEC = 60 * 60 // 1 hour

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
    { data: weightLogs },
    { data: nutritionLogs },
    { data: photoRows },
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
      .select("id, status, booked_at, sessions(start_at, classes(name_ro))")
      .eq("user_id", id)
      .order("booked_at", { ascending: false })
      .limit(10),
    supabase
      .from("plan_requests")
      .select("id, tier_id, plan_tiers(name_ro), status, created_at")
      .eq("user_id", id)
      .eq("status", "pending"),
    supabase
      .from("weight_logs")
      .select("id, logged_on, weight_kg, note")
      .eq("user_id", id)
      .order("logged_on", { ascending: false })
      .limit(20),
    supabase
      .from("nutrition_logs")
      .select("id, logged_on, calories, protein_g, carbs_g, fat_g, note")
      .eq("user_id", id)
      .order("logged_on", { ascending: false })
      .limit(20),
    supabase
      .from("progress_photos")
      .select(
        "id, taken_on, front_path, side_path, back_path, weight_kg, note",
      )
      .eq("user_id", id)
      .order("taken_on", { ascending: false })
      .limit(10),
  ])

  if (!profile) notFound()

  // Generate signed URLs for all photos in one pass.
  const photos = await Promise.all(
    (photoRows ?? []).map(async (r) => {
      const paths = [r.front_path, r.side_path, r.back_path].filter(
        (p): p is string => !!p,
      )
      const { data } = paths.length
        ? await supabase.storage
            .from("progress-photos")
            .createSignedUrls(paths, SIGNED_URL_TTL_SEC)
        : { data: [] }
      const byPath = new Map(
        (data ?? []).map((d) => [d.path ?? "", d.signedUrl]),
      )
      return {
        ...r,
        front_url: r.front_path ? byPath.get(r.front_path) : null,
        side_url: r.side_path ? byPath.get(r.side_path) : null,
        back_url: r.back_path ? byPath.get(r.back_path) : null,
      }
    }),
  )

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
          {profile.sex ? ` · ${profile.sex === "male" ? "♂" : "♀"}` : ""}
          {profile.tdee_age ? ` · ${profile.tdee_age} ani` : ""}
          {profile.tdee_height_cm
            ? ` · ${Number(profile.tdee_height_cm)} cm`
            : ""}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("trainer")}</CardTitle>
          <CardDescription>{t("trainerDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <TrainerSelect userId={profile.id} current={profile.trainer} />
          <div className="flex gap-2">
            <Link
              href={`/admin/users/${profile.id}/recurring`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("manageRecurring")}
            </Link>
            <Link
              href={`/admin/users/${profile.id}/meal-plan`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("manageMealPlan")}
            </Link>
          </div>
        </CardContent>
      </Card>

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
                      ? formatStudio(b.sessions.start_at, "EEEE d MMM, HH:mm")
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
          <CardTitle>{t("tdee")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!profile.tdee_value ? (
            <p className="text-muted-foreground">{t("noTdee")}</p>
          ) : (
            <p>
              <strong>{profile.tdee_value} kcal/zi</strong>
              {profile.tdee_activity ? ` · ${profile.tdee_activity}` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("weight")}</CardTitle>
          <CardDescription>
            {weightLogs && weightLogs.length > 0
              ? t("weightLatest", {
                  kg: Number(weightLogs[0]!.weight_kg).toFixed(1),
                  date: format(new Date(weightLogs[0]!.logged_on), "d MMM yyyy", {
                    locale: ro,
                  }),
                })
              : t("noWeightLogs")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!weightLogs || weightLogs.length === 0 ? null : (
            <ul className="divide-y text-sm">
              {weightLogs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="font-medium">
                    {Number(l.weight_kg).toFixed(1)} kg
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(l.logged_on), "EEEE d MMM yyyy", {
                      locale: ro,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("nutrition")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!nutritionLogs || nutritionLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("noNutritionLogs")}
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {nutritionLogs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between py-1.5"
                >
                  <span>
                    <strong>{l.calories ?? "—"} kcal</strong>
                    <span className="text-muted-foreground">
                      {" · P "}
                      {l.protein_g ?? "—"} · C {l.carbs_g ?? "—"} · F{" "}
                      {l.fat_g ?? "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {format(new Date(l.logged_on), "d MMM yyyy", { locale: ro })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("photos")}</CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPhotos")}</p>
          ) : (
            <div className="space-y-4">
              {photos.map((p) => (
                <div key={p.id} className="space-y-2 rounded border p-3">
                  <p className="text-sm">
                    <strong>
                      {format(new Date(p.taken_on), "d MMM yyyy", {
                        locale: ro,
                      })}
                    </strong>
                    {p.weight_kg
                      ? ` · ${Number(p.weight_kg).toFixed(1)} kg`
                      : ""}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["front", "side", "back"] as const).map((view) => {
                      const url = p[`${view}_url` as const]
                      if (!url) return null
                      return (
                        <figure key={view} className="space-y-1">
                          <div className="relative aspect-[3/4] overflow-hidden rounded border bg-muted">
                            <Image
                              src={url}
                              alt={t(`photo_${view}`)}
                              fill
                              sizes="(max-width: 640px) 100vw, 33vw"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <figcaption className="text-center text-xs text-muted-foreground">
                            {t(`photo_${view}`)}
                          </figcaption>
                        </figure>
                      )
                    })}
                  </div>
                  {p.note ? (
                    <p className="text-sm text-muted-foreground">{p.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("dietary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DietarySummary dietary={dietary} />
        </CardContent>
      </Card>
    </div>
  )
}
