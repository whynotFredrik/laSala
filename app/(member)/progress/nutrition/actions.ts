"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

export type NutritionState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const nonNegInt = z.coerce.number().int().min(0).max(20000)
const nonNegDecimal = z.coerce.number().min(0).max(2000)

const addSchema = z.object({
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calories: nonNegInt.optional(),
  proteinG: nonNegDecimal.optional(),
  carbsG: nonNegDecimal.optional(),
  fatG: nonNegDecimal.optional(),
  note: z.string().max(280).optional(),
})

export async function addNutritionLogAction(
  _prev: NutritionState,
  formData: FormData,
): Promise<NutritionState> {
  const parsed = addSchema.safeParse({
    loggedOn: formData.get("loggedOn"),
    calories: formData.get("calories") || undefined,
    proteinG: formData.get("proteinG") || undefined,
    carbsG: formData.get("carbsG") || undefined,
    fatG: formData.get("fatG") || undefined,
    note: formData.get("note") || undefined,
  })
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("nutrition_logs").upsert(
    {
      user_id: user.id,
      logged_on: parsed.data.loggedOn,
      calories: parsed.data.calories ?? null,
      protein_g: parsed.data.proteinG ?? null,
      carbs_g: parsed.data.carbsG ?? null,
      fat_g: parsed.data.fatG ?? null,
      note: parsed.data.note ?? null,
    },
    { onConflict: "user_id,logged_on" },
  )
  if (error) {
    return { status: "error", message: "save_failed" }
  }
  revalidatePath("/progress/nutrition")
  return { status: "ok" }
}

export async function deleteNutritionLogAction(id: string) {
  const { user } = await requireUser()
  const supabase = await createClient()
  await supabase
    .from("nutrition_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  revalidatePath("/progress/nutrition")
}
