"use client"

import { useActionState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { adjustPlanAction, type UserAdminState } from "./actions"

const initialState: UserAdminState = { status: "idle" }

export function AdjustPlanForm({
  planId,
  sessionsTotal,
  sessionsUsed,
  endDate,
}: {
  planId: string
  sessionsTotal: number
  sessionsUsed: number
  endDate: string
}) {
  const t = useTranslations("adminUsers")
  const [state, action, pending] = useActionState(adjustPlanAction, initialState)

  useEffect(() => {
    if (state.status === "ok") toast.success(t("planAdjusted"))
    else if (state.status === "error")
      toast.error(`${t("error")}: ${state.message}`)
  }, [state, t])

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="planId" value={planId} />
      <div className="space-y-2">
        <Label htmlFor="sessionsTotal">{t("sessionsTotal")}</Label>
        <Input
          id="sessionsTotal"
          name="sessionsTotal"
          type="number"
          inputMode="numeric"
          defaultValue={sessionsTotal}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sessionsUsed">{t("sessionsUsed")}</Label>
        <Input
          id="sessionsUsed"
          name="sessionsUsed"
          type="number"
          inputMode="numeric"
          defaultValue={sessionsUsed}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">{t("endDate")}</Label>
        <Input
          id="endDate"
          name="endDate"
          type="date"
          defaultValue={endDate}
          required
        />
      </div>
      <div className="sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  )
}
