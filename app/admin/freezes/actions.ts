"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { RULES } from "@/lib/constants"
import { scheduleCalendarSync } from "@/lib/google/schedule-sync"
import { createClient } from "@/lib/supabase/server"

export type FreezeAdminState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

/** Maps Postgres exceptions from the freeze functions to `adminFreezes.errors.*`. */
function freezeErrorKey(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("duration must be")) return "duration_out_of_range"
  if (m.includes("in the past")) return "start_in_past"
  if (m.includes("no active plan")) return "no_active_plan"
  if (m.includes("allowance exceeded")) return "allowance_exceeded"
  if (m.includes("overlaps") || m.includes("freeze_no_overlap")) {
    return "overlap"
  }
  if (m.includes("out of range")) return "remaining_out_of_range"
  if (m.includes("admin only")) return "forbidden"
  return "unknown"
}

function revalidateFreezePages(userId: string) {
  revalidatePath("/admin")
  revalidatePath("/admin/freezes")
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath("/admin/sessions")
}

const allocateSchema = z.object({
  userId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationDays: z.coerce
    .number()
    .int()
    .min(RULES.FREEZE_MIN_DAYS)
    .max(RULES.FREEZE_MAX_DAYS),
})

/**
 * Allocate a freeze to a member. Wraps `admin_freeze_membership`, which
 * re-checks the admin role, skips the member's 48h notice, applies the
 * member's remaining allowance, extends the plan and cancels the bookings
 * inside the window (migrations 0032/0033).
 */
export async function allocateFreezeAction(
  _prev: FreezeAdminState,
  formData: FormData,
): Promise<FreezeAdminState> {
  const parsed = allocateSchema.safeParse({
    userId: formData.get("userId"),
    startDate: formData.get("startDate"),
    durationDays: formData.get("durationDays"),
  })
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  // Regular client so auth.uid() inside the RPC = admin and is_admin() holds.
  const supabase = await createClient()

  const { data: before } = await supabase
    .from("bookings")
    .select("session_id")
    .eq("user_id", parsed.data.userId)
    .eq("status", "booked")

  const { error } = await supabase.rpc("admin_freeze_membership", {
    p_user_id: parsed.data.userId,
    p_start_date: parsed.data.startDate,
    p_duration_days: parsed.data.durationDays,
  })
  if (error) return { status: "error", message: freezeErrorKey(error.message) }

  // Calendar events for the bookings the freeze cancelled.
  const { data: after } = await supabase
    .from("bookings")
    .select("session_id")
    .eq("user_id", parsed.data.userId)
    .eq("status", "booked")
  const stillBooked = new Set((after ?? []).map((b) => b.session_id))
  scheduleCalendarSync(
    (before ?? [])
      .map((b) => b.session_id)
      .filter((id) => !stillBooked.has(id)),
  )

  revalidateFreezePages(parsed.data.userId)
  return { status: "ok" }
}

const remainingSchema = z.object({
  userId: z.string().uuid(),
  remainingDays: z.coerce.number().int().min(0).max(365),
})

/**
 * Set how many freeze days a member has left. Stored as an override that
 * replaces the 14-days-per-6-months rule for 6 months (migration 0033).
 */
export async function setFreezeRemainingAction(
  _prev: FreezeAdminState,
  formData: FormData,
): Promise<FreezeAdminState> {
  const parsed = remainingSchema.safeParse({
    userId: formData.get("userId"),
    remainingDays: formData.get("remainingDays"),
  })
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_set_freeze_remaining", {
    p_user_id: parsed.data.userId,
    p_remaining_days: parsed.data.remainingDays,
  })
  if (error) return { status: "error", message: freezeErrorKey(error.message) }

  revalidateFreezePages(parsed.data.userId)
  return { status: "ok" }
}

const clearSchema = z.object({ userId: z.string().uuid() })

/** Drop a member's override; the normal allowance rule applies again. */
export async function clearFreezeOverrideAction(
  _prev: FreezeAdminState,
  formData: FormData,
): Promise<FreezeAdminState> {
  const parsed = clearSchema.safeParse({ userId: formData.get("userId") })
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.rpc("admin_clear_freeze_override", {
    p_user_id: parsed.data.userId,
  })
  if (error) return { status: "error", message: freezeErrorKey(error.message) }

  revalidateFreezePages(parsed.data.userId)
  return { status: "ok" }
}
