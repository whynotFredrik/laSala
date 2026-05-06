"use server"

import { redirect } from "next/navigation"

import { resetPasswordSchema } from "@/lib/auth/schemas"
import { createClient } from "@/lib/supabase/server"

export type ResetPasswordState =
  | { status: "idle" }
  | { status: "error"; message: string }

/**
 * Sets a new password for the currently signed-in user. The user lands here
 * via the recovery email's callback link, which gives them a temporary
 * session — `updateUser` works against that session.
 */
export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  })

  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { status: "error", message: "session_expired" }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { status: "error", message: "reset_failed" }
  }

  redirect("/home")
}
