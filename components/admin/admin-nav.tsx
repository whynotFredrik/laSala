import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AdminNavLinks } from "@/components/admin/admin-nav-links"
import { Logo } from "@/components/brand/logo"
import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for admin pages. Single-row layout — the link group scrolls
 * horizontally on narrow viewports instead of wrapping. The "ADMIN" label
 * collapses to just the logo on very narrow screens.
 */
export async function AdminNav() {
  const t = await getTranslations("adminNav")
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Logo href="/admin" size="md" />
        <span className="hidden text-sm font-semibold uppercase tracking-wider text-primary sm:inline">
          Admin
        </span>
        <AdminNavLinks />
        <Link
          href="/home"
          className="hidden whitespace-nowrap rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted lg:inline"
        >
          {t("memberView")}
        </Link>
        <SignOutButton />
      </div>
    </header>
  )
}
