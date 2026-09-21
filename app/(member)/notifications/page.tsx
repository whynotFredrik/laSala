import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/get-user"
import { formatStudio } from "@/lib/booking/format"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

import { MarkReadOnOpen } from "./mark-read-on-open"

const PAGE_SIZE = 50

/** Where a notification type's call-to-action should lead, if anywhere. */
function linkFor(type: string, data: unknown): string | null {
  const d = (data ?? {}) as { tier_id?: string }
  switch (type) {
    case "renewal_reminder":
    case "expiration_warning":
      return d.tier_id ? `/plans?tier=${d.tier_id}` : "/plans"
    case "plan_activated":
      return "/home"
    case "weekly_summary":
    case "pins_booked":
      return "/history"
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

  const list = rows ?? []
  const hasUnread = list.some((n) => n.read_at === null)

  return (
    <div className="space-y-6">
      <MarkReadOnOpen hasUnread={hasUnread} />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => {
            const unread = n.read_at === null
            const href = linkFor(n.type, n.data)
            return (
              <li key={n.id}>
                <Card
                  className={cn(
                    unread && "border-primary/50 bg-primary/5",
                  )}
                >
                  <CardContent className="space-y-2 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className={cn("font-medium", unread && "text-foreground")}>
                        {unread ? (
                          <span
                            aria-label={t("unread")}
                            className="mr-2 inline-block size-2 rounded-full bg-primary align-middle"
                          />
                        ) : null}
                        {n.title}
                      </p>
                      <time
                        dateTime={n.created_at}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {formatStudio(n.created_at, "d MMM, HH:mm")}
                      </time>
                    </div>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {n.body}
                    </p>
                    {href ? (
                      <Link
                        href={href}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        {t(`cta.${n.type}` as "cta.renewal_reminder")}
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
