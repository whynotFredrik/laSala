import "server-only"

import { redirect } from "next/navigation"

import { getUser } from "@/lib/auth/get-user"

/**
 * Server helper for the auth pages. Bounces an already-authenticated
 * visitor to `/home` so they don't see the login form mid-session.
 *
 * Used by /sign-in, /sign-up, /forgot-password. Deliberately NOT used by
 * /reset-password, which legitimately runs while the user is "logged in"
 * via the recovery-link session.
 */
export async function redirectIfSignedIn() {
  const user = await getUser()
  if (user) redirect("/home")
}
