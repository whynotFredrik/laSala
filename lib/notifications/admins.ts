import "server-only"

import { sendEmail } from "@/lib/email/send"
import type { TemplateId, TemplatePropsMap } from "@/lib/email/templates"
import {
  notify,
  type NotificationType,
  type NotifyResult,
} from "@/lib/notifications/notify"
import type { Json } from "@/lib/supabase/database.types"
import { createServiceClient } from "@/lib/supabase/service"

export type NotifyAdminsArgs<T extends TemplateId> = {
  type: NotificationType
  title: string
  body: string
  data?: Json
  /** Deduped per admin: the same key twice for one admin is a no-op. */
  dedupeKey?: string
  email?: { template: T; props: TemplatePropsMap[T] }
}

/**
 * Notify every admin account (profiles.role = 'admin'): one in-app row
 * each plus the email. `ADMIN_NOTIFICATION_EMAIL`, if set and not already
 * an admin's address, gets the email too (legacy studio inbox).
 * Never throws.
 */
export async function notifyAdmins<T extends TemplateId>(
  args: NotifyAdminsArgs<T>,
): Promise<{ notified: number; results: NotifyResult[] }> {
  const service = createServiceClient()
  const { data: admins } = await service
    .from("profiles")
    .select("id, email")
    .eq("role", "admin")

  const results: NotifyResult[] = []
  const emailed = new Set<string>()
  for (const admin of admins ?? []) {
    const result = await notify({
      userId: admin.id,
      type: args.type,
      title: args.title,
      body: args.body,
      data: args.data,
      dedupeKey: args.dedupeKey,
      email: args.email
        ? { to: admin.email, template: args.email.template, props: args.email.props }
        : undefined,
    })
    results.push(result)
    if (result.status === "sent") emailed.add(admin.email.toLowerCase())
  }

  const extra = process.env.ADMIN_NOTIFICATION_EMAIL?.trim()
  if (
    extra &&
    args.email &&
    !emailed.has(extra.toLowerCase()) &&
    // Only when the event is new for at least one admin (or none exist),
    // so a deduped digest is not re-mailed to the studio inbox every day.
    (results.length === 0 || results.some((r) => r.status === "sent"))
  ) {
    await sendEmail({
      to: extra,
      userId: null,
      template: args.email.template,
      props: args.email.props,
    })
  }

  return {
    notified: results.filter((r) => r.status === "sent").length,
    results,
  }
}
