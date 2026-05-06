"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "./actions"

const initialState: ForgotPasswordState = { status: "idle" }

export function ForgotPasswordForm() {
  const t = useTranslations("auth")
  const tErrors = useTranslations("authErrors")
  const [state, action, pending] = useActionState(
    forgotPasswordAction,
    initialState,
  )

  if (state.status === "success") {
    return (
      <Alert>
        <AlertTitle>{t("resetEmailSentTitle")}</AlertTitle>
        <AlertDescription>{t("resetEmailSentBody")}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {t("sendResetLink")}
      </Button>
    </form>
  )
}
