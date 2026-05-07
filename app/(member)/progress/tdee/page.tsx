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

import { TdeeForm } from "./tdee-form"

export default async function TdeePage() {
  const { user, profile } = await requireUser()
  const t = await getTranslations("tdee")
  const supabase = await createClient()

  // Pull the most recent weight as a default, if any.
  const { data: lastWeight } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", user.id)
    .order("logged_on", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TdeeForm
          defaults={{
            age: profile.tdee_age,
            // `sex` is set at sign-up and stored on profiles; reuse it
            // for the BMR formula instead of a separate tdee_sex column.
            sex: profile.sex as "male" | "female" | null,
            heightCm: profile.tdee_height_cm
              ? Number(profile.tdee_height_cm)
              : null,
            weightKg: lastWeight?.weight_kg
              ? Number(lastWeight.weight_kg)
              : null,
            activity: profile.tdee_activity as
              | "sedentary"
              | "light"
              | "moderate"
              | "active"
              | "very_active"
              | null,
          }}
          storedValue={profile.tdee_value}
        />
      </CardContent>
    </Card>
  )
}
