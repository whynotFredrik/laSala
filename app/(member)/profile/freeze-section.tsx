import { format, subDays } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RULES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

import { FreezeForm } from "./freeze-form"

/**
 * Computes how many freeze days the user has used in the last 6 months and
 * renders the form with the remaining allowance.
 */
export async function FreezeSection({ userId }: { userId: string }) {
  const t = await getTranslations("freeze")
  const supabase = await createClient()

  const sixMonthsAgo = subDays(new Date(), 180).toISOString().slice(0, 10)

  const { data: periods } = await supabase
    .from("freeze_periods")
    .select("start_date, end_date, duration_days")
    .eq("user_id", userId)
    .gte("start_date", sixMonthsAgo)
    .order("start_date", { ascending: false })

  const used = (periods ?? []).reduce(
    (acc, p) => acc + (p.duration_days ?? 0),
    0,
  )
  const remaining = Math.max(RULES.FREEZE_TOTAL_DAYS_PER_6_MONTHS - used, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("allowance", {
            used,
            total: RULES.FREEZE_TOTAL_DAYS_PER_6_MONTHS,
            remaining,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {remaining < RULES.FREEZE_MIN_DAYS ? (
          <Alert>
            <AlertTitle>{t("noAllowanceTitle")}</AlertTitle>
            <AlertDescription>{t("noAllowanceBody")}</AlertDescription>
          </Alert>
        ) : (
          <FreezeForm remainingDays={remaining} />
        )}

        {periods && periods.length > 0 ? (
          <div className="space-y-1 pt-2">
            <p className="text-sm font-medium">{t("history")}</p>
            <ul className="text-sm text-muted-foreground">
              {periods.map((p) => (
                <li key={`${p.start_date}-${p.end_date}`}>
                  {format(new Date(p.start_date), "d MMM yyyy", { locale: ro })}{" "}
                  → {format(new Date(p.end_date), "d MMM yyyy", { locale: ro })}{" "}
                  ({p.duration_days} {t("days")})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
