"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { syncCalendarAction } from "./actions"

/**
 * Manual "push everything to Google Calendar" button. Reports counts in a
 * toast; failures list the first few error messages so the admin can act
 * (e.g. calendar not shared with the service account).
 */
export function SyncCalendarButton() {
  const t = useTranslations("adminSessions")
  const [pending, start] = useTransition()

  const handle = () =>
    start(async () => {
      let res: Awaited<ReturnType<typeof syncCalendarAction>>
      try {
        res = await syncCalendarAction()
      } catch {
        toast.error(t("syncCalendarFailed"))
        return
      }
      if (!res.configured) {
        toast.info(t("syncCalendarNotConfigured"))
        return
      }
      const counts = {
        upserted: res.upserted,
        skipped: res.skipped,
        deleted: res.deleted,
        failed: res.failed,
      }
      if (res.failed > 0) {
        toast.warning(t("syncCalendarDone", counts), {
          duration: 15_000,
          description: (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {res.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          ),
        })
      } else {
        toast.success(t("syncCalendarDone", counts))
      }
    })

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={handle}>
      {t("syncCalendar")}
    </Button>
  )
}
