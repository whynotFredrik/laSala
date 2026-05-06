"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { RULES } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

export type FreezeState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const freezeSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "freeze_invalid_date"),
  durationDays: z
    .number()
    .int()
    .min(RULES.FREEZE_MIN_DAYS, "freeze_duration_out_of_range")
    .max(RULES.FREEZE_MAX_DAYS, "freeze_duration_out_of_range"),
})

/**
 * Wraps the Postgres `freeze_membership` function. The function does the
 * 48-hour notice check, the 14-days-per-6-months allowance check, inserts
 * the freeze period, and extends the plan's end_date — atomically.
 */
export async function freezeMembershipAction(
  _prev: FreezeState,
  formData: FormData,
): Promise<FreezeState> {
  const parsed = freezeSchema.safeParse({
    startDate: formData.get("startDate"),
    durationDays: Number(formData.get("durationDays")),
  })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("freeze_membership", {
    p_start_date: parsed.data.startDate,
    p_duration_days: parsed.data.durationDays,
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("duration must be")) {
      return { status: "error", message: "freeze_duration_out_of_range" }
    }
    if (msg.includes("at least 48 hours")) {
      return { status: "error", message: "freeze_advance_notice" }
    }
    if (msg.includes("no active plan")) {
      return { status: "error", message: "no_active_plan" }
    }
    if (msg.includes("allowance exceeded")) {
      return { status: "error", message: "freeze_allowance_exceeded" }
    }
    return { status: "error", message: "unknown" }
  }

  revalidatePath("/profile")
  revalidatePath("/home")
  return { status: "ok" }
}
