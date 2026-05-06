"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"

import { resetPasswordAction, type ResetPasswordState } from "./actions"

const initialState: ResetPasswordState = { status: "idle" }

export function ResetPasswordForm() {
  const t = useTranslations("auth")
  const tErrors = useTranslations("authErrors")
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialState,
  )

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("newPassword")}</Label>
        <Input
          id="password"
          name="password"
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
          title={t("passwordHint")}
        />
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {t("setNewPassword")}
      </Button>
    </form>
  )
}
