import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { DietaryForm } from "./dietary-form"

export default async function DietaryPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("dietary")

  const { data: row } = await supabase
    .from("dietary_questionnaires")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <DietaryForm defaults={row ?? {}} />
      </CardContent>
    </Card>
  )
}
