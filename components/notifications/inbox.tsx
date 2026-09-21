import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { MarkReadOnOpen } from "@/components/notifications/mark-read-on-open"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { formatStudio } from "@/lib/booking/format"
import { cn } from "@/lib/utils"

export type InboxRow = {
  id: string
  type: string
  title: string
  body: string
  data: unknown
  read_at: string | null
  created_at: string
}

/**
 * Notification list shared by the member (`/notifications`) and admin
 * (`/admin/notifications`) inboxes. The caller decides where each type's
 * call-to-action leads and which server action marks rows read.
 */
export async function NotificationsInbox({
  rows,
  hrefFor,
  markAllRead,
  subtitle,
}: {
  rows: InboxRow[]
  hrefFor: (type: string, data: unknown) => string | null
  markAllRead: () => Promise<void>
  subtitle: string
}) {
  const t = await getTranslations("notifications")
  const hasUnread = rows.some((n) => n.read_at === null)

  return (
    <div className="space-y-6">
      <MarkReadOnOpen hasUnread={hasUnread} action={markAllRead} />
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const unread = n.read_at === null
            const href = hrefFor(n.type, n.data)
            return (
              <li key={n.id}>
                <Card
                  className={cn(unread && "border-primary/50 bg-primary/5")}
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
