"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signOutAction } from "@/lib/auth/sign-out"

export function SignOutButton() {
  const t = useTranslations("auth")
  const [pending, start] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => start(() => signOutAction())}
      aria-label={t("logout")}
    >
      <LogOut />
      <span className="hidden sm:inline">{t("logout")}</span>
    </Button>
  )
}
