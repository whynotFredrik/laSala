import Link from "next/link"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { redirectIfSignedIn } from "@/lib/auth/redirect-if-signed-in"

import { SignUpForm } from "./sign-up-form"

export default async function SignUpPage() {
  await redirectIfSignedIn()
  const t = await getTranslations("auth")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("register")}</CardTitle>
        <CardDescription>{t("welcomeTitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignUpForm />
        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyHaveAccount")}{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
