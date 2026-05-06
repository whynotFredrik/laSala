"use server"

import { redirect } from "next/navigation"

import { signInSchema } from "@/lib/auth/schemas"
import { createClient } from "@/lib/supabase/server"

export type SignInState =
  | { status: "idle" }
  | { status: "error"; message: string }

/**
 * Email/password sign-in. Validates with Zod server-side, then defers to
 * Supabase Auth. Redirects to `?next=` if it points at an internal path,
 * otherwise to /home.
 */
export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { status: "error", message: "invalid_credentials" }
  }

  const next = formData.get("next")
  const target =
    typeof next === "string" && next.startsWith("/") ? next : "/home"
  redirect(target)
}
