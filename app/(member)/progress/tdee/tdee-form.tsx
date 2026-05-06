"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { saveTdeeAction, type TdeeState } from "./actions"

const initialState: TdeeState = { status: "idle" }

const ACTIVITY = [
  { value: "sedentary", labelKey: "activity_sedentary" },
  { value: "light", labelKey: "activity_light" },
  { value: "moderate", labelKey: "activity_moderate" },
  { value: "active", labelKey: "activity_active" },
  { value: "very_active", labelKey: "activity_very_active" },
] as const

export function TdeeForm({
  defaults,
  storedValue,
}: {
  defaults: {
    age?: number | null
    sex?: "male" | "female" | null
    heightCm?: number | null
    weightKg?: number | null
    activity?:
      | "sedentary"
      | "light"
      | "moderate"
      | "active"
      | "very_active"
      | null
  }
  storedValue: number | null
}) {
  const t = useTranslations("tdee")
  const [state, action, pending] = useActionState(saveTdeeAction, initialState)

  const displayedValue =
    state.status === "ok" ? state.tdee : storedValue

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="age">{t("age")}</Label>
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min="13"
            max="100"
            defaultValue={defaults.age ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sex">{t("sex")}</Label>
          <Select name="sex" defaultValue={defaults.sex ?? undefined}>
            <SelectTrigger id="sex">
              <SelectValue placeholder={t("selectSex")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t("male")}</SelectItem>
              <SelectItem value="female">{t("female")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="heightCm">{t("heightCm")}</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="120"
            max="230"
            defaultValue={defaults.heightCm ?? ""}
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
            min="30"
            max="250"
            defaultValue={defaults.weightKg ?? ""}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="activity">{t("activity")}</Label>
          <Select
            name="activity"
            defaultValue={defaults.activity ?? undefined}
          >
            <SelectTrigger id="activity">
              <SelectValue placeholder={t("selectActivity")} />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {t(a.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {t("calculate")}
      </Button>

      {displayedValue ? (
        <Alert>
          <AlertTitle>
            {t("yourTdee")}: {displayedValue} kcal/{t("perDay")}
          </AlertTitle>
          <AlertDescription>{t("tdeeExplain")}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{t("saveFailed")}</AlertTitle>
        </Alert>
      ) : null}
    </form>
  )
}
