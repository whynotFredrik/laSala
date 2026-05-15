"use server"

import { redirect } from "next/navigation"

import { signInSchema } from "@/lib/auth/schemas"
import { createClient } from "@/lib/supabase/server"

export type SignInState =
  | { status: "idle" }
  | { status: "error"; message: string }

/**
 * Email/password sign-in. Validates with Zod server-side, then defers to
 * Supabase Auth.
 *
 * Redirect target:
 *   1. `?next=` if it points at an internal path (deep-linked from /book,
 *      /reset-password, etc.)
 *   2. `/admin` if the signed-in user is an admin
 *   3. `/home` otherwise
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
  const { data: signInData, error } =
    await supabase.auth.signInWithPassword(parsed.data)

  if (error || !signInData.user) {
    return { status: "error", message: "invalid_credentials" }
  }

  const next = formData.get("next")
  if (typeof next === "string" && next.startsWith("/")) {
    redirect(next)
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", signInData.user.id)
    .maybeSingle()

  redirect(profile?.role === "admin" ? "/admin" : "/home")
}
