"use client"

import { useActionState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { reopenDayAction, type ClosureState } from "./actions"

const initialState: ClosureState = { status: "idle" }

/** Reopens one closed day after a browser confirm. */
export default function ReopenDayButton({
  date,
  label,
}: {
  /** YYYY-MM-DD */
  date: string
  /** Human date, used in the confirm prompt. */
  label: string
}) {
  const t = useTranslations("adminClosures")
  const [state, action, pending] = useActionState(reopenDayAction, initialState)

  useEffect(() => {
    if (state.status === "ok") toast.success(t("reopened"))
    else if (state.status === "error")
      toast.error(t(`errors.${state.message}` as "errors.unknown"))
  }, [state, t])

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t("reopenConfirm", { date: label }))) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="date" value={date} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("reopen")}
      </Button>
    </form>
  )
}
