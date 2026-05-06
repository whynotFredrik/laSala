import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("setNewPassword")}</CardTitle>
        <CardDescription>{t("resetPasswordSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  )
}
