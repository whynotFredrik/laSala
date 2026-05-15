"use server"

import { redirect } from "next/navigation"

import { normalisePhone, signUpSchema } from "@/lib/auth/schemas"
import { assignTrainer } from "@/lib/auth/trainers"
import { siteUrl } from "@/lib/constants"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

export type SignUpState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; emailConfirmRequired: boolean }

/**
 * Email/password sign-up. Flow:
 * 1. Validate input (firstName, lastName, email, phone, sex, password, GDPR).
 * 2. Resolve current GDPR document version so we can stamp `gdpr_version`
 *    on the profile.
 * 3. Call `supabase.auth.signUp` with `full_name`, `first_name`, and `sex`
 *    in user metadata so the `handle_new_user` trigger picks them up.
 * 4. The trigger inserts the profile row. We then update it with phone,
 *    GDPR consent fields, and the assigned trainer using the service
 *    client (RLS would otherwise block the update before the user has a
 *    session — and email confirm may be enabled).
 *
 *    Trainer assignment: men → Eugen; women → balanced between Marina
 *    and Ana (whoever currently has fewer female members).
 * 5. Redirect: if email confirm is required, send to a "check your email"
 *    state; otherwise straight to /home.
 */
export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    sex: formData.get("sex"),
    age: formData.get("age"),
    heightCm: formData.get("heightCm"),
    password: formData.get("password"),
    gdprConsent: formData.get("gdprConsent") === "on",
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const { firstName, lastName, email, phone, sex, age, heightCm, password } =
    parsed.data
  const fullName = `${firstName} ${lastName}`.trim()

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
      data: {
        full_name: fullName,
        first_name: firstName,
        sex,
        age: String(age),
        height_cm: String(heightCm),
      },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/home`,
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

  // Auto-pick a trainer if there's a deterministic choice (men → Eugen).
  // Women are left unassigned and an admin picks Marina or Ana later.
  const trainer = await assignTrainer(sex)

  // Stamp phone + GDPR (+ trainer if auto-assigned) onto the profile.
  // The trigger handled id/email/full_name/first_name/sex/age/height. We
  // re-write age + height here as well so a deployment with the OLD
  // trigger doesn't silently drop them — defensive belt-and-braces.
  const { error: updateError } = await service
    .from("profiles")
    .update({
      phone: normalisePhone(phone),
      tdee_age: age,
      tdee_height_cm: heightCm,
      gdpr_consented_at: new Date().toISOString(),
      gdpr_version: gdpr?.version ?? null,
      ...(trainer ? { trainer } : {}),
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
