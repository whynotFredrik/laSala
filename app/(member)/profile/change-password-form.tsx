"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"

import { changePasswordAction, type ProfileState } from "./actions"

const initialState: ProfileState = { status: "idle" }

export function ChangePasswordForm() {
  const t = useTranslations("auth")
  const tProfile = useTranslations("profilePage")
  const tErrors = useTranslations("authErrors")
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialState,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">{t("newPassword")}</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          pattern="\S{8,}"
          title={t("passwordHint")}
        />
        <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">{t("confirmNewPassword")}</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          pattern="\S{8,}"
        />
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : state.status === "ok" ? (
        <Alert>
          <AlertTitle>{tProfile("passwordChanged")}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t("setNewPassword")}
      </Button>
    </form>
  )
}
