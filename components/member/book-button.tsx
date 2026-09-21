"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { bookSessionAction } from "@/app/(member)/book/actions"

/** Errors that mean "you need (another) plan" — the toast links to /plans. */
const PLAN_ERRORS = new Set([
  "no_active_plan",
  "plan_exhausted",
  "plan_expires_before_session",
])

export function BookButton({
  sessionId,
  disabled,
  label,
}: {
  sessionId: string
  disabled?: boolean
  label: string
}) {
  const t = useTranslations("booking")
  const tErrors = useTranslations("bookingErrors")
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const result = await bookSessionAction(sessionId)
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
            toast.success(t("bookingSuccess"))
          }
        })
      }
    >
      {label}
    </Button>
  )
}
