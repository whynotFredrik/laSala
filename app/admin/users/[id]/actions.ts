"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
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

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmEmail: z.string().email(),
})

/**
 * Hard-delete a user. Removes the auth user via the admin API; the
 * `profiles` row and every owned row (bookings, plans, plan_requests,
 * weight_logs, nutrition_logs, progress_photos, dietary_questionnaires,
 * meal_plans, recurring_bookings, freeze_periods) cascade away via the
 * `on delete cascade` foreign keys.
 *
 * Storage files (progress photos) are NOT cascaded — they live in
 * Supabase Storage. We list & delete them explicitly first.
 *
 * Two guardrails:
 *   1. Caller must be admin.
 *   2. The admin must retype the target user's email — defends against
 *      a misclick blowing away the wrong account.
 */
export async function deleteUserAction(formData: FormData) {
  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmEmail: formData.get("confirmEmail"),
  })
  if (!parsed.success) {
    return { status: "error" as const, message: "invalid_input" }
  }

  const { user: caller } = await requireAdmin()
  if (caller.id === parsed.data.userId) {
    return { status: "error" as const, message: "cannot_delete_self" }
  }

  const service = createServiceClient()

  // Verify the email matches before we touch anything.
  const { data: target } = await service
    .from("profiles")
    .select("id, email")
    .eq("id", parsed.data.userId)
    .maybeSingle()
  if (!target) {
    return { status: "error" as const, message: "user_not_found" }
  }
  if (
    target.email?.toLowerCase().trim() !==
    parsed.data.confirmEmail.toLowerCase().trim()
  ) {
    return { status: "error" as const, message: "email_mismatch" }
  }

  // Clean up storage objects (cascade FKs only handle DB rows).
  const { data: photoRows } = await service
    .from("progress_photos")
    .select("front_path, side_path, back_path")
    .eq("user_id", parsed.data.userId)
  const paths = (photoRows ?? []).flatMap((r) =>
    [r.front_path, r.side_path, r.back_path].filter(
      (p): p is string => !!p,
    ),
  )
  if (paths.length > 0) {
    await service.storage.from("progress-photos").remove(paths)
  }

  // Delete the auth user; cascade does the rest.
  const { error } = await service.auth.admin.deleteUser(parsed.data.userId)
  if (error) {
    return { status: "error" as const, message: "delete_failed" }
  }

  revalidatePath("/admin/users")
  redirect("/admin/users")
}
