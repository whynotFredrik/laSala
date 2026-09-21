"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

/**
 * Mark the signed-in admin's own notifications as read. User-scoped client:
 * RLS and the `read_at`-only column grant enforce ownership.
 */
export async function markAdminNotificationsReadAction(): Promise<void> {
  const { user } = await requireAdmin()
  const supabase = await createClient()
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null)
  revalidatePath("/admin/notifications")
  revalidatePath("/admin", "layout")
}
