"use client"

import { useActionState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { addNutritionLogAction, type NutritionState } from "./actions"

const initialState: NutritionState = { status: "idle" }

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function NutritionForm() {
  const t = useTranslations("progress")
  const [state, action, pending] = useActionState(
    addNutritionLogAction,
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
    <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
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
        <Label htmlFor="calories">{t("calories")}</Label>
        <Input
          id="calories"
          name="calories"
          type="number"
          inputMode="numeric"
          min="0"
          max="20000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="proteinG">{t("proteinG")}</Label>
        <Input
          id="proteinG"
          name="proteinG"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="2000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="carbsG">{t("carbsG")}</Label>
        <Input
          id="carbsG"
          name="carbsG"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="2000"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fatG">{t("fatG")}</Label>
        <Input
          id="fatG"
          name="fatG"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          max="2000"
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {t("add")}
        </Button>
      </div>
    </form>
  )
}
