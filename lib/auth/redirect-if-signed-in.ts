import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

/**
 * Server helper for the auth pages. Bounces an already-authenticated
 * visitor to the right landing — `/admin` for admins, `/home` for members
 * — so they don't see the login form mid-session.
 *
 * Used by /sign-in, /sign-up, /forgot-password. Deliberately NOT used by
 * /reset-password, which legitimately runs while the user is "logged in"
 * via the recovery-link session.
 */
export async function redirectIfSignedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  redirect(profile?.role === "admin" ? "/admin" : "/home")
}
