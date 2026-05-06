"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { bookSessionAction } from "@/app/(member)/book/actions"

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
            toast.error(tErrors(result.message))
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
