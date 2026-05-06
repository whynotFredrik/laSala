"use server"

import { redirect } from "next/navigation"

import { normalisePhone, signUpSchema } from "@/lib/auth/schemas"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type SignUpState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; emailConfirmRequired: boolean }

/**
 * Email/password sign-up. Flow:
 * 1. Validate input.
 * 2. Resolve current GDPR document version so we can stamp `gdpr_version`
 *    on the profile.
 * 3. Call `supabase.auth.signUp` with `full_name` in user metadata so the
 *    `handle_new_user` trigger picks it up.
 * 4. The trigger inserts the profile row. We then update it with phone +
 *    GDPR consent fields using the service client (RLS would otherwise
 *    block the update before the user has a session — and email confirm may
 *    be enabled).
 * 5. Redirect: if email confirm is required, send to a "check your email"
 *    state; otherwise straight to /home.
 */
export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    gdprConsent: formData.get("gdprConsent") === "on",
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const { fullName, email, phone, password } = parsed.data

  const supabase = await createClient()
  const service = createServiceClient()

  // Resolve current GDPR version (anyone can read the current row per RLS).
  const { data: gdpr } = await supabase
    .from("gdpr_document")
    .select("version")
    .eq("is_current", true)
    .single()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL ?? ""
      }/auth/callback?next=/home`,
    },
  })

  if (signUpError) {
    if (signUpError.message.toLowerCase().includes("already")) {
      return { status: "error", message: "email_taken" }
    }
    return { status: "error", message: "sign_up_failed" }
  }

  const userId = signUpData.user?.id
  if (!userId) {
    return { status: "error", message: "sign_up_failed" }
  }

  // Stamp phone + GDPR onto the profile (the trigger only handles id/email/full_name).
  const { error: updateError } = await service
    .from("profiles")
    .update({
      phone: normalisePhone(phone),
      gdpr_consented_at: new Date().toISOString(),
      gdpr_version: gdpr?.version ?? null,
    })
    .eq("id", userId)

  if (updateError) {
    // Best-effort: leave the auth user in place but surface the error so the
    // member can complete the profile after sign-in.
    return { status: "error", message: "profile_update_failed" }
  }

  // If the project requires email confirmation, signUpData.session is null.
  const emailConfirmRequired = !signUpData.session

  if (emailConfirmRequired) {
    return { status: "success", emailConfirmRequired: true }
  }

  redirect("/home")
}
