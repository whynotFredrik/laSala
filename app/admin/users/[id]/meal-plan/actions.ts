"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

const schema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(120),
  bodyMd: z.string().min(1).max(50_000),
})

export type MealPlanResult =
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Inserts a new meal plan version for a member. Each save creates a new
 * row (history is preserved); the member's view shows the most recent.
 */
export async function publishMealPlanAction(input: {
  userId: string
  title: string
  bodyMd: string
}): Promise<MealPlanResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }
  const { user: admin } = await requireAdmin()
  const service = createServiceClient()

  const { error } = await service.from("meal_plans").insert({
    user_id: parsed.data.userId,
    title: parsed.data.title,
    body_md: parsed.data.bodyMd,
    created_by: admin.id,
  })
  if (error) {
    return { status: "error", message: "save_failed" }
  }
  revalidatePath(`/admin/users/${parsed.data.userId}/meal-plan`)
  revalidatePath("/profile")
  return { status: "ok" }
}

export async function deleteMealPlanAction(input: {
  mealPlanId: string
  userId: string
}) {
  await requireAdmin()
  const service = createServiceClient()
  await service.from("meal_plans").delete().eq("id", input.mealPlanId)
  revalidatePath(`/admin/users/${input.userId}/meal-plan`)
  revalidatePath("/profile")
}
