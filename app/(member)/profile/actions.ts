"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { normalisePhone } from "@/lib/auth/schemas"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

const phoneRegex = /^(\+40|0040|0)?[0-9]{9}$/

export type ProfileState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; message: string }

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().trim().regex(phoneRegex, "phone_invalid"),
})

/**
 * Updates the current user's `full_name` and `phone` on `profiles`. RLS lets
 * a user update only their own row.
 */
export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: normalisePhone(parsed.data.phone),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    return { status: "error", message: "profile_update_failed" }
  }

  revalidatePath("/profile")
  revalidatePath("/home")
  return { status: "ok" }
}

const passwordChangeSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "password_too_short")
      .regex(/^\S+$/, "password_no_spaces"),
    confirm: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirm, {
    path: ["confirm"],
    message: "passwords_do_not_match",
  })

export async function changePasswordAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = passwordChangeSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirm: formData.get("confirm"),
  })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (error) {
    return { status: "error", message: "password_update_failed" }
  }

  return { status: "ok" }
}
