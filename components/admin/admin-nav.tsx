import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { AdminNavLinks } from "@/components/admin/admin-nav-links"
import { Logo } from "@/components/brand/logo"
import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for admin pages. The active-section underline lives in the
 * Client subcomponent `<AdminNavLinks>` so it can read the pathname.
 */
export async function AdminNav() {
  const t = await getTranslations("adminNav")
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl flex-wrap items-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <Logo href="/admin" size="md" />
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Admin
          </span>
        </div>
        <AdminNavLinks />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/home"
            className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("memberView")}
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
