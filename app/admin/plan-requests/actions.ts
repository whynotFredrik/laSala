"use server"

import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { sendEmail } from "@/lib/email/send"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const approveSchema = z.object({
  requestId: z.string().uuid(),
  // Bank transfer is no longer offered — studio accepts only in-person
  // POS or cash. Historical records in the DB may still hold
  // 'bank_transfer'; the schema rejects it for new approvals.
  paymentMethod: z.enum(["pos", "cash"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export type PlanRequestAdminResult =
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Loads requester + tier details for the email. Uses service client because
 * the admin reading another user's profile is allowed by RLS but service
 * keeps the fetch simple regardless of policy nuances.
 */
async function loadRequestContext(requestId: string) {
  const service = createServiceClient()
  const { data } = await service
    .from("plan_requests")
    .select(
      "id, profiles!user_id(id, full_name, email, sex), plan_tiers(name_ro, price_male_ron, price_female_ron)",
    )
    .eq("id", requestId)
    .maybeSingle()
  if (!data || !data.profiles || !data.plan_tiers) return null
  const sex = data.profiles.sex as "male" | "female" | null
  return {
    userId: data.profiles.id,
    name: data.profiles.full_name ?? data.profiles.email,
    email: data.profiles.email,
    planName: data.plan_tiers.name_ro,
    price: Number(
      sex === "female"
        ? data.plan_tiers.price_female_ron
        : data.plan_tiers.price_male_ron,
    ),
  }
}

/**
 * Wraps the Postgres `approve_plan_request` function which atomically:
 * deactivates the user's existing active plan, inserts a new active plan,
 * and flips the request to 'approved'. After success, sends the
 * "plan approved" email with the new plan's session count + end date.
 */
export async function approvePlanRequestAction(input: {
  requestId: string
  paymentMethod: "pos" | "cash"
  startDate: string
}): Promise<PlanRequestAdminResult> {
  const parsed = approveSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  await requireAdmin()
  const supabase = await createClient()
  const ctx = await loadRequestContext(parsed.data.requestId)

  const { data: plan, error } = await supabase.rpc("approve_plan_request", {
    p_request_id: parsed.data.requestId,
    p_payment_method: parsed.data.paymentMethod,
    p_start_date: parsed.data.startDate,
  })
  if (error) {
    return { status: "error", message: "approve_failed" }
  }

  if (ctx && plan) {
    await sendEmail({
      to: ctx.email,
      userId: ctx.userId,
      template: "planApproved",
      props: {
        name: ctx.name,
        planName: ctx.planName,
        sessionsTotal: plan.sessions_total,
        endDate: format(new Date(plan.end_date), "d MMMM yyyy", { locale: ro }),
      },
    })
  }

  revalidatePath("/admin/plan-requests")
  revalidatePath("/admin")
  return { status: "ok" }
}

export async function rejectPlanRequestAction(input: {
  requestId: string
  reason?: string
}): Promise<PlanRequestAdminResult> {
  const parsed = rejectSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  await requireAdmin()
  const supabase = await createClient()
  const ctx = await loadRequestContext(parsed.data.requestId)

  const { error } = await supabase
    .from("plan_requests")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason ?? null,
    })
    .eq("id", parsed.data.requestId)
    .eq("status", "pending")
  if (error) {
    return { status: "error", message: "reject_failed" }
  }

  if (ctx) {
    await sendEmail({
      to: ctx.email,
      userId: ctx.userId,
      template: "planRejected",
      props: {
        name: ctx.name,
        planName: ctx.planName,
        reason: parsed.data.reason ?? "",
      },
    })
  }

  revalidatePath("/admin/plan-requests")
  return { status: "ok" }
}
