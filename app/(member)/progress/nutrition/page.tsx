import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { NutritionForm } from "./nutrition-form"
import { DeleteNutritionButton } from "./delete-button"

export default async function NutritionPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("progress")

  const { data: logs } = await supabase
    .from("nutrition_logs")
    .select("id, logged_on, calories, protein_g, carbs_g, fat_g, note")
    .eq("user_id", user.id)
    .order("logged_on", { ascending: false })
    .limit(60)

  const list = logs ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("addEntry")}</CardTitle>
        </CardHeader>
        <CardContent>
          <NutritionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
          ) : (
            <ul className="divide-y">
              {list.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {l.calories ?? "—"} kcal
                      {" · "}
                      <span className="text-muted-foreground">
                        P {l.protein_g ?? "—"} · C {l.carbs_g ?? "—"} · F{" "}
                        {l.fat_g ?? "—"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(l.logged_on), "EEEE d MMM yyyy", {
                        locale: ro,
                      })}
                    </p>
                  </div>
                  <DeleteNutritionButton id={l.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
