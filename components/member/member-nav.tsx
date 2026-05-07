import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Logo } from "@/components/brand/logo"
import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for authenticated member pages. Logo on the left links back to
 * /home, link row scrolls horizontally on narrow screens, sign-out anchored
 * to the right.
 */
export async function MemberNav() {
  const t = await getTranslations("nav")

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <Logo href="/home" variant="icon" />
        <nav className="-mx-1 ml-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 text-sm">
          <Link
            href="/home"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("home")}
          </Link>
          <Link
            href="/book"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("book")}
          </Link>
          <Link
            href="/history"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("history")}
          </Link>
          <Link
            href="/progress"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("progress")}
          </Link>
          <Link
            href="/plans"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("plans")}
          </Link>
          <Link
            href="/profile"
            className="whitespace-nowrap rounded px-2 py-1 hover:bg-muted"
          >
            {t("profile")}
          </Link>
        </nav>
        <SignOutButton />
      </div>
    </header>
  )
}
