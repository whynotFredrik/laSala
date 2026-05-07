import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

/**
 * Shows the most recent meal plan published for this member by an admin.
 * RLS on `meal_plans` already restricts members to their own rows; this
 * just picks the latest one.
 */
export async function MealPlanCard({ userId }: { userId: string }) {
  const t = await getTranslations("mealPlan")
  const supabase = await createClient()

  const { data: latest } = await supabase
    .from("meal_plans")
    .select("title, body_md, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {latest
            ? `${t("publishedOn")}: ${format(
                new Date(latest.created_at),
                "d MMM yyyy",
                { locale: ro },
              )}`
            : t("none")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!latest ? (
          <p className="text-sm text-muted-foreground">{t("noneBody")}</p>
        ) : (
          <article className="space-y-2">
            <h3 className="font-medium">{latest.title}</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-sm leading-relaxed">
              {latest.body_md}
            </pre>
          </article>
        )}
      </CardContent>
    </Card>
  )
}
