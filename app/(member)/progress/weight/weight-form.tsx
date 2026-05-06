"use client"

import { useActionState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { addWeightLogAction, type WeightLogState } from "./actions"

const initialState: WeightLogState = { status: "idle" }

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function WeightForm() {
  const t = useTranslations("progress")
  const [state, action, pending] = useActionState(
    addWeightLogAction,
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "ok") {
      toast.success(t("savedTitle"))
      formRef.current?.reset()
    } else if (state.status === "error") {
      toast.error(t("saveFailed"))
    }
  }, [state, t])

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div className="space-y-2">
        <Label htmlFor="loggedOn">{t("date")}</Label>
        <Input
          id="loggedOn"
          name="loggedOn"
          type="date"
          defaultValue={todayIsoDate()}
          max={todayIsoDate()}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="weightKg">{t("weightKg")}</Label>
        <Input
          id="weightKg"
          name="weightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="20"
          max="300"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {t("add")}
      </Button>
    </form>
  )
}
