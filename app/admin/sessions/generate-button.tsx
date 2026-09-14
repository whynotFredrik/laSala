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
 *
 * When recurring auto-bookings were skipped, a second toast lists each
 * member, the session date and the reason, so the admin can act on it.
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
        return
      }
      toast.success(
        t("generated", {
          created: res.created,
          skipped: res.skipped,
          recurringBooked: res.recurringBooked,
          recurringSkipped: res.recurringSkipped,
        }),
      )
      if (res.recurringSkips.length > 0) {
        toast.warning(
          t("recurringSkipsTitle", { count: res.recurringSkips.length }),
          {
            duration: 15_000,
            description: (
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {res.recurringSkips.map((s) => (
                  <li key={`${s.userId}-${s.sessionDate}`}>
                    {t("recurringSkipLine", {
                      name: s.name,
                      date: s.sessionDate,
                      reason: t(`recurringSkipReasons.${s.reason}`),
                    })}
                  </li>
                ))}
              </ul>
            ),
          },
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
