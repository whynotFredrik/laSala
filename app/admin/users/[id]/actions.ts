"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

export type UserAdminState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const adjustPlanSchema = z.object({
  planId: z.string().uuid(),
  sessionsTotal: z.coerce.number().int().min(0).max(500),
  sessionsUsed: z.coerce.number().int().min(0).max(500),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Manually adjust an active plan. Uses service-role to bypass RLS — but
 * still calls `requireAdmin()` first so non-admins can't reach here even
 * if they've forged a request. CLAUDE.md hard rule #2 + #4.
 */
export async function adjustPlanAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const parsed = adjustPlanSchema.safeParse({
    planId: formData.get("planId"),
    sessionsTotal: formData.get("sessionsTotal"),
    sessionsUsed: formData.get("sessionsUsed"),
    endDate: formData.get("endDate"),
  })
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }
  if (parsed.data.sessionsUsed > parsed.data.sessionsTotal) {
    return { status: "error", message: "used_exceeds_total" }
  }

  await requireAdmin()
  const service = createServiceClient()

  const { error } = await service
    .from("plans")
    .update({
      sessions_total: parsed.data.sessionsTotal,
      sessions_used: parsed.data.sessionsUsed,
      end_date: parsed.data.endDate,
    })
    .eq("id", parsed.data.planId)

  if (error) {
    return { status: "error", message: "save_failed" }
  }
  revalidatePath("/admin/users")
  return { status: "ok" }
}

export async function setUserRoleAction(input: {
  userId: string
  role: "member" | "admin"
}) {
  await requireAdmin()
  const service = createServiceClient()
  const { error } = await service
    .from("profiles")
    .update({ role: input.role, updated_at: new Date().toISOString() })
    .eq("id", input.userId)
  if (error) {
    return { status: "error" as const, message: "save_failed" }
  }
  revalidatePath(`/admin/users/${input.userId}`)
  return { status: "ok" as const }
}

const trainerSchema = z.object({
  userId: z.string().uuid(),
  trainer: z.enum(["Eugen", "Marina", "Ana"]),
})

/**
 * Reassign a member to a different trainer. The auto-assignment at
 * sign-up only runs once; admins use this to move a member after the
 * fact (e.g. accommodating a member preference).
 */
export async function setUserTrainerAction(input: {
  userId: string
  trainer: "Eugen" | "Marina" | "Ana"
}) {
  const parsed = trainerSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error" as const, message: "invalid_input" }
  }
  await requireAdmin()
  const service = createServiceClient()
  const { error } = await service
    .from("profiles")
    .update({
      trainer: parsed.data.trainer,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.userId)
  if (error) {
    return { status: "error" as const, message: "save_failed" }
  }
  revalidatePath(`/admin/users/${input.userId}`)
  return { status: "ok" as const }
}
