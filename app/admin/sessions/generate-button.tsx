"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { generateNextWeekSessionsAction } from "./actions"

export function GenerateNextWeekButton() {
  const t = useTranslations("adminSessions")
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await generateNextWeekSessionsAction()
          if (res.status === "error") toast.error(t("generateFailed"))
          else
            toast.success(
              t("generated", {
                created: res.created,
                skipped: res.skipped,
                recurringBooked: res.recurringBooked,
                recurringSkipped: res.recurringSkipped,
              }),
            )
        })
      }
    >
      {t("generateNextWeek")}
    </Button>
  )
}
