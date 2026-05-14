"use server"

import { forgotPasswordSchema } from "@/lib/auth/schemas"
import { siteUrl } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"

export type ForgotPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" }

/**
 * Sends a password-reset email via Supabase. We always return "success" even
 * if the email isn't registered, to avoid leaking which addresses exist.
 */
export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  })

  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const supabase = await createClient()
  // siteUrl() guarantees an absolute https URL even if NEXT_PUBLIC_SITE_URL
  // is unset or scheme-less. Supabase rejects relative `redirectTo` values
  // silently and falls back to the dashboard's Site URL — which was the
  // localhost default that produced the broken links.
  const redirectTo = `${siteUrl()}/auth/callback?type=recovery&next=/reset-password`

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

  // Don't surface whether the email exists.
  return { status: "success" }
}
