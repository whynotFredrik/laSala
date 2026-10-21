import "server-only"

import { cookies } from "next/headers"
import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export const ADMIN_PREVIEW_COOKIE = "admin_preview"

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

/**
 * Returns the authenticated Supabase user or null. Server-side only — uses
 * `getUser()` which validates the JWT against the auth server, not the
 * cached session (which a client could forge).
 *
 * Wrapped in React `cache()` so the layout, nav and page of one request
 * share a single auth round trip. The memo is per server request, never
 * across requests or users; outside a render (server actions, route
 * handlers) it simply runs every time.
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/** The profile row for `userId`, memoized per request like `getUser`. */
const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
  return data
})

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
  const user = await getUser()

  if (!user) {
    redirect("/sign-in")
  }

  const profile = await getProfile(user.id)

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

/**
 * Like requireUser but additionally bounces admins away. Admins don't have
 * member-facing functionality (no bookings, no plan, no progress); when
 * they hit a member route we send them to /admin where they belong.
 *
 * Exception: if the `admin_preview` cookie is set (admin opted into preview
 * mode for testing), admins are allowed through so they can see the member
 * UI exactly as members do.
 */
export async function requireMember() {
  const { user, profile } = await requireUser()
  if (profile.role === "admin") {
    const cookieStore = await cookies()
    const preview = cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value === "1"
    if (!preview) {
      redirect("/admin")
    }
  }
  return { user, profile }
}

/**
 * Returns true if the current user is an admin currently in member-preview
 * mode. Use to render the "exit preview" banner. Returns false for normal
 * members (cookie absent or user is genuinely a member).
 */
export async function isAdminPreviewing(): Promise<boolean> {
  const cookieStore = await cookies()
  if (cookieStore.get(ADMIN_PREVIEW_COOKIE)?.value !== "1") return false
  const user = await getUser()
  if (!user) return false
  const profile = await getProfile(user.id)
  return profile?.role === "admin"
}
