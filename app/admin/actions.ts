"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { requireAdmin, ADMIN_PREVIEW_COOKIE } from "@/lib/auth/get-user"

/**
 * Enter "member preview" mode: sets a cookie that allows the admin
 * through `requireMember()` guards so they can see the member-facing
 * UI for testing. Cookie is short-lived (8 hours) and httpOnly.
 */
export async function enterMemberPreviewAction() {
  await requireAdmin()
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_PREVIEW_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  })
  redirect("/home")
}

/**
 * Exit "member preview" mode and return to the admin dashboard.
 * Called from the preview banner on member pages.
 */
export async function exitMemberPreviewAction() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_PREVIEW_COOKIE)
  redirect("/admin")
}
