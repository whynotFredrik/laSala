import { getTranslations } from "next-intl/server"

import { NotificationsInbox } from "@/components/notifications/inbox"
import { requireAdmin } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { markAdminNotificationsReadAction } from "./actions"

const PAGE_SIZE = 50

/** Where an admin notification's call-to-action should lead. */
function hrefFor(type: string, data: unknown): string | null {
  const d = (data ?? {}) as { user_id?: string }
  switch (type) {
    case "admin_plan_request":
      return "/admin/plan-requests"
    case "admin_expiry_digest":
      return "/admin/users"
    default:
      return d.user_id ? `/admin/users/${d.user_id}` : null
  }
}

export default async function AdminNotificationsPage() {
  const { user } = await requireAdmin()
  const supabase = await createClient()
  const t = await getTranslations("notifications")

  // Admins can read every row under RLS; the inbox is still their own.
  const { data: rows } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  return (
    <NotificationsInbox
      rows={rows ?? []}
      hrefFor={hrefFor}
      markAllRead={markAdminNotificationsReadAction}
      subtitle={t("subtitleAdmin")}
    />
  )
}
