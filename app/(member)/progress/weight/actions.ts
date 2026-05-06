"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

export type WeightLogState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const addSchema = z.object({
  loggedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().positive().max(500),
  note: z.string().max(280).optional(),
})

export async function addWeightLogAction(
  _prev: WeightLogState,
  formData: FormData,
): Promise<WeightLogState> {
  const parsed = addSchema.safeParse({
    loggedOn: formData.get("loggedOn"),
    weightKg: formData.get("weightKg"),
    note: formData.get("note") || undefined,
  })
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()
  // Upsert: weight_logs has unique(user_id, logged_on) — re-logging the same
  // day overwrites instead of erroring out.
  const { error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: user.id,
        logged_on: parsed.data.loggedOn,
        weight_kg: parsed.data.weightKg,
        note: parsed.data.note ?? null,
      },
      { onConflict: "user_id,logged_on" },
    )

  if (error) {
    return { status: "error", message: "save_failed" }
  }

  revalidatePath("/progress/weight")
  return { status: "ok" }
}

export async function deleteWeightLogAction(id: string) {
  const { user } = await requireUser()
  const supabase = await createClient()
  // RLS already restricts to own rows, but defensively scope by user_id too.
  await supabase
    .from("weight_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  revalidatePath("/progress/weight")
}
