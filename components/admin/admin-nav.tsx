import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { SignOutButton } from "@/components/member/sign-out-button"

const LINKS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/plan-requests", key: "planRequests" },
  { href: "/admin/sessions", key: "sessions" },
  { href: "/admin/schedule", key: "schedule" },
  { href: "/admin/plan-tiers", key: "planTiers" },
  { href: "/admin/gdpr", key: "gdpr" },
] as const

/**
 * Top nav for admin pages. Strictly server-rendered; the active-tab
 * highlight is intentionally omitted so we can render in a Server Component.
 */
export async function AdminNav() {
  const t = await getTranslations("adminNav")
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
        <Link
          href="/admin"
          className="font-semibold tracking-tight"
        >
          Lasala · Admin
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded px-2 py-1 hover:bg-muted"
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>
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
