import "server-only"

import { Resend } from "resend"

import { EMAIL_SENDERS } from "@/lib/constants"
import { createServiceClient } from "@/lib/supabase/service"

import { renderEmailLayout } from "./layout"
import { TEMPLATES, type TemplateId, type TemplatePropsMap } from "./templates"

let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error("RESEND_API_KEY is not set")
    }
    resendInstance = new Resend(key)
  }
  return resendInstance
}

export type SendArgs<T extends TemplateId> = {
  to: string
  template: T
  props: TemplatePropsMap[T]
  /** If the recipient is a member, pass their id so we can correlate. */
  userId?: string | null
}

/**
 * The single entry point for transactional email. Wraps Resend and writes a
 * row to `email_log` for both successes and failures. Never call
 * `resend.emails.send` directly anywhere else — that would bypass the log
 * and the layout.
 *
 * Failures don't throw — the caller (a server action) shouldn't fail just
 * because email is down. Errors are logged so an admin can chase them later.
 */
export async function sendEmail<T extends TemplateId>(
  args: SendArgs<T>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tpl = TEMPLATES[args.template]
  if (!tpl) {
    return { ok: false, error: `unknown_template:${args.template}` }
  }

  const rendered = tpl(args.props)
  const { html, plainText } = renderEmailLayout({
    heading: rendered.heading,
    body: rendered.body,
  })

  const from = EMAIL_SENDERS[rendered.sender]
  const service = createServiceClient()

  try {
    const resend = getResend()
    const { data, error } = await resend.emails.send({
      from,
      to: args.to,
      subject: rendered.subject,
      html,
      text: plainText,
    })

    if (error) {
      await service.from("email_log").insert({
        user_id: args.userId ?? null,
        to_email: args.to,
        subject: rendered.subject,
        template: args.template,
        status: "error",
        error: error.message,
      })
      return { ok: false, error: error.message }
    }

    await service.from("email_log").insert({
      user_id: args.userId ?? null,
      to_email: args.to,
      subject: rendered.subject,
      template: args.template,
      status: "sent",
      resend_id: data?.id ?? null,
    })
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown"
    // Best-effort log; if even this fails we just drop the breadcrumb.
    try {
      await service.from("email_log").insert({
        user_id: args.userId ?? null,
        to_email: args.to,
        subject: rendered.subject,
        template: args.template,
        status: "error",
        error: message,
      })
    } catch {
      // ignore
    }
    return { ok: false, error: message }
  }
}
