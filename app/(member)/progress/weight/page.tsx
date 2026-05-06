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

import { WeightForm } from "./weight-form"
import { WeightChart } from "./weight-chart"
import { DeleteWeightButton } from "./delete-button"

export default async function WeightPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("progress")

  const { data: logs } = await supabase
    .from("weight_logs")
    .select("id, logged_on, weight_kg, note")
    .eq("user_id", user.id)
    .order("logged_on", { ascending: false })
    .limit(60)

  const list = logs ?? []
  // Chart wants oldest first, left-to-right.
  const chartPoints = [...list].reverse()

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("addEntry")}</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightForm />
        </CardContent>
      </Card>

      {chartPoints.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WeightChart points={chartPoints} />
          </CardContent>
        </Card>
      ) : null}

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
                      {Number(l.weight_kg).toFixed(1)} kg
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(l.logged_on), "EEEE d MMM yyyy", {
                        locale: ro,
                      })}
                    </p>
                  </div>
                  <DeleteWeightButton id={l.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
