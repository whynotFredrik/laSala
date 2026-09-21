"use server"

import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { bookPinsForUser, touchedSessionIds } from "@/lib/booking/recurring"
import { sendEmail } from "@/lib/email/send"
import { scheduleCalendarSync } from "@/lib/google/schedule-sync"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import { getActivePlan } from "@/lib/plans/active"
import { planActivatedDedupeKey } from "@/lib/plans/rules"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const approveSchema = z.object({
  requestId: z.string().uuid(),
  // Bank transfer is no longer offered — studio accepts only in-person
  // POS or cash. Historical records in the DB may still hold
  // 'bank_transfer'; the schema rejects it for new approvals.
  paymentMethod: z.enum(["pos", "cash"]),
  // Only meaningful when the plan activates immediately; ignored (queued)
  // when the member still has a usable plan.
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export type PlanRequestAdminResult =
  | { status: "ok"; outcome?: "queued" | "active" }
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
 * Wraps the Postgres `approve_plan_request` function. If the member still
 * has a usable plan the new one is QUEUED (activates by itself when the
 * current one runs out); otherwise it is activated right away and the
 * member's recurring pins are booked immediately. Either way the request
 * flips to 'approved' and the member gets an in-app notification + email.
 */
export async function approvePlanRequestAction(input: {
  requestId: string
  paymentMethod: "pos" | "cash"
  startDate?: string
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
    p_start_date: parsed.data.startDate ?? null,
  })
  if (error || !plan) {
    return { status: "error", message: "approve_failed" }
  }

  const outcome = plan.status === "queued" ? "queued" : "active"

  if (ctx) {
    const copy = notificationCopy()
    if (outcome === "queued") {
      const service = createServiceClient()
      const current = await getActivePlan(service, ctx.userId)
      const currentEndDate = current
        ? format(new Date(current.end_date), "d MMMM yyyy", { locale: ro })
        : "—"
      await notify({
        userId: ctx.userId,
        type: "plan_queued",
        title: copy("planQueuedTitle"),
        body: copy("planQueuedBody", {
          planName: ctx.planName,
          sessionsTotal: plan.sessions_total,
          currentEndDate,
        }),
        data: { plan_id: plan.id },
        email: {
          to: ctx.email,
          template: "planQueued",
          props: {
            name: ctx.name,
            planName: ctx.planName,
            sessionsTotal: plan.sessions_total,
            currentEndDate,
          },
        },
      })
    } else {
      const endDate = format(new Date(plan.end_date), "d MMMM yyyy", {
        locale: ro,
      })
      await notify({
        userId: ctx.userId,
        type: "plan_activated",
        title: copy("planActivatedTitle", { planName: ctx.planName }),
        body: copy("planActivatedBody", {
          sessionsTotal: plan.sessions_total,
          endDate,
        }),
        data: { plan_id: plan.id },
        dedupeKey: planActivatedDedupeKey(plan.id),
        email: {
          to: ctx.email,
          template: "planActivated",
          props: {
            name: ctx.name,
            planName: ctx.planName,
            sessionsTotal: plan.sessions_total,
            endDate,
          },
        },
      })

      // Recurring pins that were skipped for lack of a plan get their
      // bookings now instead of at the next daily sync.
      const service = createServiceClient()
      const outcomes = await bookPinsForUser(service, ctx.userId)
      scheduleCalendarSync(touchedSessionIds(outcomes))
    }
  }

  revalidatePath("/admin/plan-requests")
  revalidatePath("/admin")
  revalidatePath("/admin/sessions")
  revalidatePath("/home")
  revalidatePath("/plans")
  return { status: "ok", outcome }
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
