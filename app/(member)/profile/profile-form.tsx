"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"

import { updateProfileAction, type ProfileState } from "./actions"

const initialState: ProfileState = { status: "idle" }

export function ProfileForm({
  defaultName,
  defaultPhone,
  defaultAge,
  defaultHeightCm,
}: {
  defaultName: string
  defaultPhone: string
  defaultAge: number | null
  defaultHeightCm: number | null
}) {
  const t = useTranslations("auth")
  const tProfile = useTranslations("profilePage")
  const tErrors = useTranslations("authErrors")
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialState,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("name")}</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaultName}
          required
          minLength={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultPhone}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="age">{t("age")}</Label>
          <Input
            id="age"
            name="age"
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            defaultValue={defaultAge ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heightCm">{t("heightCm")}</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={120}
            max={230}
            defaultValue={defaultHeightCm ?? ""}
          />
        </div>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : state.status === "ok" ? (
        <Alert>
          <AlertTitle>{tProfile("savedTitle")}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {tProfile("save")}
      </Button>
    </form>
  )
}
