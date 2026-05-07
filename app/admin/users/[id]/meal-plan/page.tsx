import Link from "next/link"
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
import { createClient } from "@/lib/supabase/server"

import { MealPlanEditor } from "./meal-plan-editor"

export default async function AdminMealPlanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const t = await getTranslations("adminMealPlans")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", id)
    .maybeSingle()
  if (!profile) notFound()

  const { data: history } = await supabase
    .from("meal_plans")
    .select("id, title, body_md, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/admin/users/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {profile.full_name ?? profile.email}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("publishNew")}</CardTitle>
          <CardDescription>{t("publishNewDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MealPlanEditor userId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPlans")}</p>
          ) : (
            <ul className="space-y-3">
              {history.map((mp) => (
                <li key={mp.id} className="rounded border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium">{mp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(mp.created_at), "d MMM yyyy", {
                        locale: ro,
                      })}
                    </p>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                    {mp.body_md}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/admin/users/${id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        ← {t("back")}
      </Link>
    </div>
  )
}
