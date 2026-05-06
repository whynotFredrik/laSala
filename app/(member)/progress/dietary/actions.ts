"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

const FLAGS = [
  "gluten_intolerance",
  "lactose_intolerance",
  "nut_allergy",
  "egg_allergy",
  "soy_allergy",
  "shellfish_allergy",
  "fish_allergy",
  "exclude_pork",
  "exclude_beef",
  "exclude_poultry",
  "exclude_seafood",
  "exclude_dairy",
  "exclude_eggs",
  "exclude_gluten",
  "exclude_soy",
  "exclude_nuts",
  "exclude_alcohol",
  "exclude_caffeine",
  "exclude_sugar",
  "exclude_processed_foods",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "paleo",
  "low_carb",
  "low_fat",
  "high_protein",
] as const

export type DietaryState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const schema = z
  .object(
    Object.fromEntries(FLAGS.map((f) => [f, z.boolean()])) as Record<
      (typeof FLAGS)[number],
      z.ZodBoolean
    >,
  )
  .extend({
    additional_notes: z.string().max(1000).nullable().optional(),
  })

/**
 * Saves the dietary questionnaire (upsert by user_id, the table's PK).
 */
export async function saveDietaryAction(
  _prev: DietaryState,
  formData: FormData,
): Promise<DietaryState> {
  const flags = Object.fromEntries(
    FLAGS.map((f) => [f, formData.get(f) === "on"]),
  )
  const parsed = schema.safeParse({
    ...flags,
    additional_notes:
      typeof formData.get("additional_notes") === "string"
        ? (formData.get("additional_notes") as string)
        : null,
  })
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("dietary_questionnaires")
    .upsert(
      {
        user_id: user.id,
        ...parsed.data,
        additional_notes: parsed.data.additional_notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

  if (error) {
    return { status: "error", message: "save_failed" }
  }
  revalidatePath("/progress/dietary")
  return { status: "ok" }
}
