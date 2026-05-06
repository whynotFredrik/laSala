"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cancelBookingAction } from "@/app/(member)/book/actions"

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("booking")
  const tErrors = useTranslations("bookingErrors")
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (!confirm(t("cancelConfirm"))) return
          const result = await cancelBookingAction(bookingId)
          if (result.status === "error") {
            toast.error(tErrors(result.message))
          } else {
            toast.success(t("cancelSuccess"))
          }
        })
      }
    >
      {t("cancel")}
    </Button>
  )
}
