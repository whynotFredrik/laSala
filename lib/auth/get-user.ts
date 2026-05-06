import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

/**
 * Returns the authenticated Supabase user or null. Server-side only — uses
 * `getUser()` which validates the JWT against the auth server, not the
 * cached session (which a client could forge).
 */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Returns the auth user joined to their profile row. Throws (via redirect)
 * if either is missing — use this in pages/actions that must be authenticated.
 * Middleware already gates these routes; this is the second line of defense
 * for components that don't run through middleware (e.g. server actions
 * imported by client code).
 */
export async function requireUser(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>
  profile: ProfileRow
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) {
    // Trigger should have created this; if it didn't, something is wrong.
    redirect("/sign-in")
  }

  return { user, profile }
}

/**
 * Like requireUser but additionally enforces role === 'admin'. Sends
 * non-admins back to /home.
 */
export async function requireAdmin() {
  const { user, profile } = await requireUser()
  if (profile.role !== "admin") {
    redirect("/home")
  }
  return { user, profile }
}
