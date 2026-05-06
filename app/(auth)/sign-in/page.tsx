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

import { SignInForm } from "./sign-in-form"

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  await redirectIfSignedIn()
  const t = await getTranslations("auth")
  const { next } = await searchParams

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("login")}</CardTitle>
        <CardDescription>{t("welcomeSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignInForm next={next} />
        <p className="text-center text-sm text-muted-foreground">
          {t("dontHaveAccount")}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("register")}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
