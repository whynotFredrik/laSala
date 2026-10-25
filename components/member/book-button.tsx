"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  bookSessionAction,
  rescheduleBookingAction,
} from "@/app/(member)/book/actions"

/** Errors that mean "you need (another) plan" — the toast links to /plans. */
const PLAN_ERRORS = new Set([
  "no_active_plan",
  "plan_exhausted",
  "plan_expires_before_session",
])

/**
 * Books `sessionId`. With `moveBookingId` it instead moves that booking
 * (the member's booking on the same day) here via `reschedule_booking` —
 * a second booking on the same day would be rejected.
 */
export function BookButton({
  sessionId,
  disabled,
  label,
  moveBookingId,
}: {
  sessionId: string
  disabled?: boolean
  label: string
  moveBookingId?: string
}) {
  const t = useTranslations("booking")
  const tErrors = useTranslations("bookingErrors")
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant={moveBookingId ? "outline" : "default"}
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = moveBookingId
            ? await rescheduleBookingAction(moveBookingId, sessionId)
            : await bookSessionAction(sessionId)
          if (result.status === "error") {
            if (PLAN_ERRORS.has(result.message)) {
              toast.error(tErrors(result.message), {
                action: {
                  label: t("choosePlan"),
                  onClick: () => router.push("/plans"),
                },
              })
            } else {
              toast.error(tErrors(result.message))
            }
          } else {
            toast.success(
              t(moveBookingId ? "rescheduleSuccess" : "bookingSuccess"),
            )
          }
        })
      }
    >
      {label}
    </Button>
  )
}
