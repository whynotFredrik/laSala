"use client"

import { useActionState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  clearFreezeOverrideAction,
  setFreezeRemainingAction,
  type FreezeAdminState,
} from "./actions"

const initialState: FreezeAdminState = { status: "idle" }

/** Inline "days left" editor for one member, plus "back to the rule". */
export default function RemainingDaysForm({
  userId,
  remainingDays,
  hasOverride,
}: {
  userId: string
  remainingDays: number
  hasOverride: boolean
}) {
  const t = useTranslations("adminFreezes")
  const [setState, setAction, setPending] = useActionState(
    setFreezeRemainingAction,
    initialState,
  )
  const [clearState, clearAction, clearPending] = useActionState(
    clearFreezeOverrideAction,
    initialState,
  )

  useEffect(() => {
    if (setState.status === "ok") toast.success(t("remainingSaved"))
    else if (setState.status === "error")
      toast.error(t(`errors.${setState.message}` as "errors.unknown"))
  }, [setState, t])

  useEffect(() => {
    if (clearState.status === "ok") toast.success(t("overrideCleared"))
    else if (clearState.status === "error")
      toast.error(t(`errors.${clearState.message}` as "errors.unknown"))
  }, [clearState, t])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={setAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={userId} />
        <Input
          key={remainingDays}
          name="remainingDays"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          defaultValue={remainingDays}
          aria-label={t("remainingDays")}
          className="h-8 w-20"
          required
        />
        <Button type="submit" size="sm" variant="outline" disabled={setPending}>
          {t("setRemaining")}
        </Button>
      </form>
      {hasOverride ? (
        <form action={clearAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" size="sm" variant="ghost" disabled={clearPending}>
            {t("clearOverride")}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
