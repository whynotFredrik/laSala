import Link from "next/link"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/server"

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()
  const t = await getTranslations("adminUsers")

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, created_at")
    .order("created_at", { ascending: false })
    .limit(100)
  if (q) {
    // PostgREST `or` filter on the joined cols.
    const term = `%${q.replace(/%/g, "")}%`
    query = query.or(
      `email.ilike.${term},full_name.ilike.${term},phone.ilike.${term}`,
    )
  }
  const { data: profiles } = await query

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
            {profiles?.length ?? 0} {t("results")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!profiles || profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="divide-y">
              {profiles.map((p) => (
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
