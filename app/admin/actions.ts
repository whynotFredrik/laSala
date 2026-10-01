"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireAdmin, ADMIN_PREVIEW_COOKIE } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

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

const agendaRecipientSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  trainer: z.enum(["Eugen", "Marina", "Ana"]).nullable(),
})

export type AgendaRecipientResult =
  | { status: "ok" }
  | { status: "error"; message: "invalid_email" | "already_added" | "save_failed" }

/**
 * Add an address to the evening "tomorrow's schedule" email
 * (`/api/cron/daily-agenda`). `trainer` limits it to that trainer's
 * sessions; null = the whole studio.
 */
export async function addAgendaRecipientAction(input: {
  email: string
  trainer: string | null
}): Promise<AgendaRecipientResult> {
  const parsed = agendaRecipientSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "invalid_email" }

  const { user } = await requireAdmin()
  const service = createServiceClient()
  const { error } = await service.from("daily_agenda_recipients").insert({
    email: parsed.data.email,
    trainer: parsed.data.trainer,
    created_by: user.id,
  })
  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "already_added" : "save_failed",
    }
  }
  revalidatePath("/admin")
  return { status: "ok" }
}

export async function removeAgendaRecipientAction(
  id: string,
): Promise<AgendaRecipientResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { status: "error", message: "save_failed" }

  await requireAdmin()
  const service = createServiceClient()
  const { error } = await service
    .from("daily_agenda_recipients")
    .delete()
    .eq("id", parsed.data)
  if (error) return { status: "error", message: "save_failed" }
  revalidatePath("/admin")
  return { status: "ok" }
}
