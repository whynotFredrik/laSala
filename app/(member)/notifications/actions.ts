"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

/**
 * Mark every unread notification of the signed-in member as read. Uses the
 * user-scoped client so RLS (and the `read_at`-only column grant) enforce
 * ownership — no user id is taken from the caller.
 */
export async function markAllReadAction(): Promise<void> {
  const { user } = await requireUser()
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
  revalidatePath("/notifications")
  revalidatePath("/", "layout")
}

const markReadSchema = z.object({ id: z.string().uuid() })

export async function markReadAction(input: { id: string }): Promise<void> {
  const parsed = markReadSchema.safeParse(input)
  if (!parsed.success) return
  const { user } = await requireUser()
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("read_at", null)
  revalidatePath("/notifications")
}
