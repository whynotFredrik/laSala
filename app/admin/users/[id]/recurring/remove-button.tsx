"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { removeRecurringAction } from "./actions"

export function RemoveRecurringButton({
  recurringId,
  userId,
}: {
  recurringId: string
  userId: string
}) {
  const t = useTranslations("adminRecurring")
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={t("remove")}
      onClick={() => {
        if (!confirm(t("removeConfirm"))) return
        start(() => removeRecurringAction({ recurringId, userId }))
      }}
    >
      <Trash2 />
    </Button>
  )
}
