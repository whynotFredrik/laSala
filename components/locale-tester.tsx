"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

/**
 * Smoke test for next-intl in a Client Component. Verifies that
 * `NextIntlClientProvider` is wrapping the tree and that `useTranslations`
 * resolves keys client-side.
 */
export function LocaleTester() {
  const tNav = useTranslations("nav")
  const tAuth = useTranslations("auth")

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{tNav("home")}</span>
      <Button variant="outline" size="sm">
        {tAuth("login")}
      </Button>
    </div>
  )
}
