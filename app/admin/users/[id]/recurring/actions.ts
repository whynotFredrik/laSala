"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

const addSchema = z.object({
  userId: z.string().uuid(),
  scheduleTemplateId: z.string().uuid(),
})

export type RecurringResult =
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Pin a member to a schedule slot. The partial unique index handles the
 * "already recurring on this slot" case — surfaced as `already_recurring`.
 */
export async function addRecurringAction(input: {
  userId: string
  scheduleTemplateId: string
}): Promise<RecurringResult> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  const { user: admin } = await requireAdmin()
  const service = createServiceClient()

  const { error } = await service.from("recurring_bookings").insert({
    user_id: parsed.data.userId,
    schedule_template_id: parsed.data.scheduleTemplateId,
    created_by: admin.id,
  })

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "already_recurring" }
    }
    return { status: "error", message: "save_failed" }
  }
  revalidatePath(`/admin/users/${parsed.data.userId}/recurring`)
  return { status: "ok" }
}

export async function removeRecurringAction(input: {
  recurringId: string
  userId: string
}) {
  await requireAdmin()
  const service = createServiceClient()
  await service
    .from("recurring_bookings")
    .update({ is_active: false })
    .eq("id", input.recurringId)
  revalidatePath(`/admin/users/${input.userId}/recurring`)
}
