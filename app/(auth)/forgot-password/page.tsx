import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { ForgotPasswordForm } from "./forgot-password-form"

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("forgotPassword")}</CardTitle>
        <CardDescription>{t("forgotPasswordSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("backToSignIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
