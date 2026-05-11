"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

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
 * Admin nav link row. Underlines the active section. The "/admin" link is
 * only active on exact-match because every admin page has it as a prefix —
 * otherwise it'd always look active.
 */
export function AdminNavLinks() {
  const t = useTranslations("adminNav")
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap items-center gap-1 self-stretch text-sm">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname === link.href || pathname.startsWith(link.href + "/")
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex h-full items-center whitespace-nowrap border-b-2 border-transparent px-2 transition-colors hover:text-foreground",
              active
                ? "border-primary font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {t(link.key)}
          </Link>
        )
      })}
    </nav>
  )
}
