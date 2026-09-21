"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { sendEmail } from "@/lib/email/send"
import { notifyAdmins } from "@/lib/notifications/admins"
import { notificationCopy } from "@/lib/notifications/notify"
import { getActivePlan } from "@/lib/plans/active"
import { nextStreakMonth, streakDiscountRon } from "@/lib/plans/streak"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const requestSchema = z.object({
  tierId: z.string().uuid(),
  // Bank transfer was removed from the available payment methods — studio
  // now accepts only in-person card (POS) or cash. The DB enum still has
  // `bank_transfer` for historical records, but we don't accept it on
  // new requests.
  paymentMethod: z.enum(["pos", "cash"]).optional(),
  notes: z.string().max(500).optional(),
})

export type PlanRequestState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Inserts a `plan_requests` row in `pending` state, then:
 *   1. Emails the requester an acknowledgement (here's how to pay).
 *   2. Notifies every admin — in-app row + email (who/what/how-much).
 *
 * The partial unique index `(user_id) where status = 'pending'` blocks
 * duplicate pending requests — surface that as `already_pending`. An
 * active plan does NOT block a request: an on-time renewal merges into it
 * on approval.
 */
export async function requestPlanAction(
  input: z.infer<typeof requestSchema>,
): Promise<PlanRequestState> {
  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const { user, profile } = await requireUser()
  const supabase = await createClient()

  const { data: inserted, error } = await supabase
    .from("plan_requests")
    .insert({
      user_id: user.id,
      tier_id: parsed.data.tierId,
      preferred_payment_method: parsed.data.paymentMethod ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "already_pending" }
    }
    return { status: "error", message: "request_failed" }
  }

  // Look up the tier name + price so we can put it in the emails. Use the
  // service client because RLS restricts read access on plan_tiers to active.
  const service = createServiceClient()
  const [{ data: tier }, activePlan] = await Promise.all([
    service
      .from("plan_tiers")
      .select("name_ro, category, price_male_ron, price_female_ron")
      .eq("id", parsed.data.tierId)
      .maybeSingle(),
    getActivePlan(service, user.id),
  ])

  if (tier) {
    const planName = tier.name_ro
    // Pick the price column for the requester's sex; fall back to male
    // price for legacy accounts where sex is unset.
    const basePrice = Number(
      profile.sex === "female" ? tier.price_female_ron : tier.price_male_ron,
    )
    // Quote the streak-discounted price the member will pay if they settle
    // before their current plan expires. The authoritative amount is decided
    // at approval time in `approve_plan_request`.
    const discount =
      tier.category === "monthly"
        ? streakDiscountRon(nextStreakMonth(activePlan))
        : 0
    const price = Math.max(basePrice - discount, 0)
    const recipientName = profile.full_name ?? profile.email

    // 1. User ack
    await sendEmail({
      to: profile.email,
      userId: user.id,
      template: "planRequestReceived",
      props: { name: recipientName, planName, price },
    })

    // 2. Admins: in-app notification + email, one per admin account.
    const copy = notificationCopy()
    const paymentMethod = parsed.data.paymentMethod ?? "—"
    await notifyAdmins({
      type: "admin_plan_request",
      title: copy("adminPlanRequestTitle", { name: recipientName }),
      body: copy("adminPlanRequestBody", {
        name: recipientName,
        email: profile.email,
        planName,
        price,
        paymentMethod,
      }),
      data: { request_id: inserted?.id ?? null, user_id: user.id },
      dedupeKey: inserted ? `admin_plan_request:${inserted.id}` : undefined,
      email: {
        template: "adminPlanRequestNew",
        props: {
          userName: recipientName,
          userEmail: profile.email,
          planName,
          price,
          paymentMethod,
        },
      },
    })
  }

  revalidatePath("/plans")
  revalidatePath("/home")
  return { status: "ok" }
}
