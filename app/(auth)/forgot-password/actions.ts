"use server"

import { forgotPasswordSchema } from "@/lib/auth/schemas"
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
  const redirectTo = `${
    process.env.NEXT_PUBLIC_SITE_URL ?? ""
  }/auth/callback?type=recovery&next=/reset-password`

  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo })

  // Don't surface whether the email exists.
  return { status: "success" }
}
