"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { sendEmail } from "@/lib/email/send"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

const requestSchema = z.object({
  tierId: z.string().uuid(),
  paymentMethod: z.enum(["bank_transfer", "pos", "cash"]).optional(),
  notes: z.string().max(500).optional(),
})

export type PlanRequestState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

/**
 * Inserts a `plan_requests` row in `pending` state, then sends two emails:
 *   1. Acknowledgement to the requester (here's how to pay).
 *   2. Notification to the admin inbox (who/what/how-much).
 *
 * The partial unique index `(user_id) where status = 'pending'` blocks
 * duplicate pending requests — surface that as `already_pending`.
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

  const { error } = await supabase.from("plan_requests").insert({
    user_id: user.id,
    tier_id: parsed.data.tierId,
    preferred_payment_method: parsed.data.paymentMethod ?? null,
    notes: parsed.data.notes ?? null,
  })

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "already_pending" }
    }
    return { status: "error", message: "request_failed" }
  }

  // Look up the tier name + price so we can put it in the emails. Use the
  // service client because RLS restricts read access on plan_tiers to active.
  const service = createServiceClient()
  const { data: tier } = await service
    .from("plan_tiers")
    .select("name_ro, price_ron")
    .eq("id", parsed.data.tierId)
    .maybeSingle()

  if (tier) {
    const planName = tier.name_ro
    const price = Number(tier.price_ron)
    const recipientName = profile.full_name ?? profile.email

    // 1. User ack
    await sendEmail({
      to: profile.email,
      userId: user.id,
      template: "planRequestReceived",
      props: { name: recipientName, planName, price },
    })

    // 2. Admin notification — to the configured admin inbox if set.
    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL
    if (adminTo) {
      await sendEmail({
        to: adminTo,
        userId: null,
        template: "adminPlanRequestNew",
        props: {
          userName: recipientName,
          userEmail: profile.email,
          planName,
          price,
          paymentMethod: parsed.data.paymentMethod ?? "—",
        },
      })
    }
  }

  revalidatePath("/plans")
  revalidatePath("/home")
  return { status: "ok" }
}
