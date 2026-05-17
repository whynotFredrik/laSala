"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import {
  generateCurrentWeekSessionsAction,
  generateNextWeekSessionsAction,
  type GenerateSessionsResult,
} from "./actions"

/**
 * Two buttons:
 *   - "Generează săptămâna viitoare" — normal weekly action.
 *   - "Generează săptămâna curentă" — fallback when the Sunday run was
 *     missed and members can't see this week's sessions.
 * Both call the same idempotent generator under the hood.
 */
export function GenerateNextWeekButton() {
  const t = useTranslations("adminSessions")
  const [pending, start] = useTransition()

  const handle = (
    fn: () => Promise<GenerateSessionsResult>,
  ) =>
    start(async () => {
      const res = await fn()
      if (res.status === "error") {
        toast.error(t("generateFailed"))
      } else {
        toast.success(
          t("generated", {
            created: res.created,
            skipped: res.skipped,
            recurringBooked: res.recurringBooked,
            recurringSkipped: res.recurringSkipped,
          }),
        )
      }
    })

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => handle(generateCurrentWeekSessionsAction)}
      >
        {t("generateCurrentWeek")}
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() => handle(generateNextWeekSessionsAction)}
      >
        {t("generateNextWeek")}
      </Button>
    </div>
  )
}
