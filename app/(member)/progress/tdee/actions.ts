"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"
import { ACTIVITY_LEVELS, tdee, type ActivityLevel, type Sex } from "@/lib/tdee"

const schema = z.object({
  age: z.coerce.number().int().min(13).max(100),
  sex: z.enum(["male", "female"]),
  heightCm: z.coerce.number().min(120).max(230),
  weightKg: z.coerce.number().min(30).max(250),
  activity: z.enum(
    ACTIVITY_LEVELS as unknown as [ActivityLevel, ...ActivityLevel[]],
  ),
})

export type TdeeState =
  | { status: "idle" }
  | { status: "ok"; tdee: number }
  | { status: "error"; message: string }

export async function saveTdeeAction(
  _prev: TdeeState,
  formData: FormData,
): Promise<TdeeState> {
  const parsed = schema.safeParse({
    age: formData.get("age"),
    sex: formData.get("sex"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
    activity: formData.get("activity"),
  })
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const value = tdee({
    sex: parsed.data.sex as Sex,
    age: parsed.data.age,
    heightCm: parsed.data.heightCm,
    weightKg: parsed.data.weightKg,
    activity: parsed.data.activity as ActivityLevel,
  })

  const { user } = await requireUser()
  const supabase = await createClient()
  // We persist `sex` here as well, so the unified profile.sex stays in
  // sync if the user adjusts it for TDEE purposes (e.g. fixed at sign-up
  // but later corrected).
  const { error } = await supabase
    .from("profiles")
    .update({
      tdee_age: parsed.data.age,
      sex: parsed.data.sex,
      tdee_height_cm: parsed.data.heightCm,
      tdee_activity: parsed.data.activity,
      tdee_value: value,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    return { status: "error", message: "save_failed" }
  }

  revalidatePath("/progress/tdee")
  return { status: "ok", tdee: value }
}
