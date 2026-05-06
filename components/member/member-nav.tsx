import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for authenticated member pages. Mobile-first: shows brand on the
 * left, a collapsing link row in the center, and sign-out on the right.
 */
export async function MemberNav() {
  const t = await getTranslations("nav")

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
        <Link href="/home" className="font-semibold tracking-tight">
          Lasala
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link
            href="/home"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("home")}
          </Link>
          <Link
            href="/book"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("book")}
          </Link>
          <Link
            href="/history"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("history")}
          </Link>
          <Link
            href="/progress"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("progress")}
          </Link>
          <Link
            href="/plans"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("plans")}
          </Link>
          <Link
            href="/profile"
            className="rounded px-2 py-1 hover:bg-muted"
          >
            {t("profile")}
          </Link>
        </nav>
        <SignOutButton />
      </div>
    </header>
  )
}
