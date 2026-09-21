import "server-only"

import { createTranslator } from "next-intl"

import { sendEmail } from "@/lib/email/send"
import type { TemplateId, TemplatePropsMap } from "@/lib/email/templates"
import type { Json } from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/service"
import messages from "@/messages/ro.json"

export type NotificationType =
  | "plan_activated"
  | "renewal_reminder"
  | "weekly_summary"
  | "pins_booked"
  | "expiration_warning"

export type NotifyArgs<T extends TemplateId> = {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Json
  /**
   * Same key twice for the same user → the second call is a no-op
   * (`duplicate`) and no email is sent. Leave empty for one-off messages.
   */
  dedupeKey?: string
  /** Optional email for the same event, sent only when the row is new. */
  email?: { to: string; template: T; props: TemplatePropsMap[T] }
}

export type NotifyResult =
  | { status: "sent"; id: string }
  | { status: "duplicate" }
  | { status: "error"; error: string }

/**
 * Single entry point for member notifications: inserts the in-app row
 * (service role — call only from server actions and route handlers that
 * have already established who the member is) and, when the row is new,
 * sends the matching email through `sendEmail`.
 *
 * Never throws: a failed notification must not fail the booking/plan
 * mutation that triggered it.
 */
export async function notify<T extends TemplateId>(
  args: NotifyArgs<T>,
): Promise<NotifyResult> {
  const service = createServiceClient()
  const { data, error } = await service
    .from("notifications")
    .insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data ?? {},
      dedupe_key: args.dedupeKey ?? null,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return { status: "duplicate" }
    return { status: "error", error: error.message }
  }

  if (args.email) {
    await sendEmail({
      to: args.email.to,
      userId: args.userId,
      template: args.email.template,
      props: args.email.props,
    })
  }
  return { status: "sent", id: data.id }
}

/**
 * Romanian copy for notifications, usable outside a request (cron routes,
 * `after()` callbacks) — plain `createTranslator` over the bundled
 * messages instead of the request-bound `getTranslations`.
 */
export function notificationCopy() {
  return createTranslator({
    locale: "ro",
    messages,
    namespace: "notifications",
  })
}
