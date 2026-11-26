import { getTranslations } from "next-intl/server"

import { NotificationsInbox } from "@/components/notifications/inbox"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { markAllReadAction } from "./actions"

const PAGE_SIZE = 50

/** Where a member notification's call-to-action should lead, if anywhere. */
function hrefFor(type: string, data: unknown): string | null {
  const d = (data ?? {}) as { tier_id?: string }
  switch (type) {
    case "renewal_reminder":
    case "expiration_warning":
      return d.tier_id ? `/plans?tier=${d.tier_id}` : "/plans"
    case "plan_activated":
    case "plan_extended":
    case "plan_extension_reverted":
      return "/home"
    case "weekly_summary":
    case "pins_booked":
      return "/history"
    case "studio_closed":
      return "/book"
    default:
      return null
  }
}

export default async function NotificationsPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("notifications")

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
      markAllRead={markAllReadAction}
      subtitle={t("subtitle")}
    />
  )
}
