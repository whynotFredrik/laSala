import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { z } from "zod"

import { buttonVariants } from "@/components/ui/button"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25

const pageSchema = z.coerce.number().int().min(1).catch(1)

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = sp.q
  const requestedPage = pageSchema.parse(sp.page)
  const supabase = await createClient()
  const t = await getTranslations("adminUsers")

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
  if (q) {
    // PostgREST `or` filter on the joined cols.
    const term = `%${q.replace(/%/g, "")}%`
    query = query.or(
      `email.ilike.${term},full_name.ilike.${term},phone.ilike.${term}`,
    )
  }
  const from = (requestedPage - 1) * PAGE_SIZE
  const { data: profiles, count } = await query.range(
    from,
    from + PAGE_SIZE - 1,
  )
  const total = count ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const pageHref = (n: number) => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (n > 1) params.set("page", String(n))
    const qs = params.toString()
    return qs ? `/admin/users?${qs}` : "/admin/users"
  }
  // Past the last page (e.g. a search narrowed the list): PostgREST
  // returns no rows for an out-of-range slice, so go to the last page.
  if (requestedPage > pageCount) redirect(pageHref(pageCount))
  const page = requestedPage

  const navClass = cn(buttonVariants({ variant: "outline", size: "icon" }))
  const navDisabledClass = cn(navClass, "pointer-events-none opacity-50")

  // Fetch active plans for the listed members in one shot, then index by
  // user_id. Avoids N+1 and lets us render a badge inline.
  const memberIds = (profiles ?? [])
    .filter((p) => p.role === "member")
    .map((p) => p.id)
  const today = new Date().toISOString().slice(0, 10)
  const { data: activePlans } = memberIds.length
    ? await supabase
        .from("plans")
        .select(
          "user_id, end_date, sessions_total, sessions_used, plan_tiers(name_ro)",
        )
        .in("user_id", memberIds)
        .eq("is_active", true)
        .gte("end_date", today)
    : { data: [] }
  const planByUser = new Map(
    (activePlans ?? []).map((p) => [p.user_id, p] as const),
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      </header>

      <form className="flex items-end gap-2" method="get">
        <div className="flex-1 space-y-2">
          <Label htmlFor="q">{t("search")}</Label>
          <Input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} {t("results")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="divide-y">
              {profiles.map((p) => {
                const plan = planByUser.get(p.id)
                const remaining = plan
                  ? Math.max(
                      0,
                      (plan.sessions_total ?? 0) - (plan.sessions_used ?? 0),
                    )
                  : 0
                return (
                  <li key={p.id} className="py-2">
                    <Link
                      href={`/admin/users/${p.id}`}
                      className="flex items-center justify-between gap-3 hover:underline"
                    >
                      <div className="space-y-0.5">
                        <p className="font-medium">{p.full_name ?? p.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.email}
                          {p.phone ? ` · ${p.phone}` : ""}
                          {" · "}
                          {p.role}
                          {" · "}
                          {format(new Date(p.created_at), "d MMM yyyy", {
                            locale: ro,
                          })}
                        </p>
                      </div>
                      {p.role === "member" ? (
                        plan ? (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {plan.plan_tiers?.name_ro ?? t("activePlan")}
                            {" · "}
                            {t("sessionsLeft", { count: remaining })}
                            {" · "}
                            {t("until", {
                              date: format(new Date(plan.end_date), "d MMM", {
                                locale: ro,
                              }),
                            })}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {t("noActivePlanShort")}
                          </span>
                        )
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          {pageCount > 1 ? (
            <nav
              aria-label={t("pagination")}
              className="mt-4 flex items-center justify-between gap-2 border-t pt-4"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className={navClass}
                  aria-label={t("previousPage")}
                  title={t("previousPage")}
                >
                  <ChevronLeft className="size-4" />
                </Link>
              ) : (
                <span className={navDisabledClass} aria-hidden>
                  <ChevronLeft className="size-4" />
                </span>
              )}
              <p className="text-sm text-muted-foreground">
                {t("pageOf", { page, total: pageCount })}
              </p>
              {page < pageCount ? (
                <Link
                  href={pageHref(page + 1)}
                  className={navClass}
                  aria-label={t("nextPage")}
                  title={t("nextPage")}
                >
                  <ChevronRight className="size-4" />
                </Link>
              ) : (
                <span className={navDisabledClass} aria-hidden>
                  <ChevronRight className="size-4" />
                </span>
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
