import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { ScheduleEditor, type ScheduleSlot } from "./schedule-editor"

export default async function AdminSchedulePage() {
  const supabase = await createClient()
  const t = await getTranslations("adminSchedule")

  const { data: slots } = await supabase
    .from("schedule_template")
    .select(
      "id, day_of_week, start_hour, start_minute, duration_min, capacity, is_enabled, class_id",
    )
    .order("day_of_week", { ascending: true })
    .order("start_hour", { ascending: true })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t("templateTitle")}</CardTitle>
          <CardDescription>{t("templateDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleEditor slots={(slots ?? []) as ScheduleSlot[]} />
        </CardContent>
      </Card>
    </div>
  )
}
