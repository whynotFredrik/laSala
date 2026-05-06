"use client"

import Link from "next/link"
import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

import { signUpAction, type SignUpState } from "./actions"

const initialState: SignUpState = { status: "idle" }

export function SignUpForm() {
  const t = useTranslations("auth")
  const tErrors = useTranslations("authErrors")
  const [state, action, pending] = useActionState(signUpAction, initialState)

  if (state.status === "success" && state.emailConfirmRequired) {
    return (
      <Alert>
        <AlertTitle>{t("checkEmailTitle")}</AlertTitle>
        <AlertDescription>{t("checkEmailBody")}</AlertDescription>
      </Alert>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">{t("name")}</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          minLength={2}
        />
      </div>

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

      <div className="space-y-2">
        <Label htmlFor="phone">{t("phone")}</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="07XX XXX XXX"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
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
        <p className="text-xs text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          id="gdprConsent"
          name="gdprConsent"
          type="checkbox"
          required
          className="mt-0.5 size-4"
        />
        <span>
          {t.rich("gdprConsent", {
            link: (chunks) => (
              <Link
                href="/gdpr"
                className="underline underline-offset-4"
                target="_blank"
              >
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {t("register")}
      </Button>
    </form>
  )
}
