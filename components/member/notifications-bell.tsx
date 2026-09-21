import Link from "next/link"
import { Bell } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { getUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

/**
 * Bell icon with the unread-notification count for the signed-in member.
 * Server component: the count is read under the member's own RLS.
 */
export async function NotificationsBell() {
  const t = await getTranslations("notifications")
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null)

  const unread = count ?? 0
  const label = unread > 0 ? t("unreadCount", { count: unread }) : t("title")

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bell className="size-5" />
      {unread > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  )
}
