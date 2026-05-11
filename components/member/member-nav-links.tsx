"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/home", key: "home" },
  { href: "/book", key: "book" },
  { href: "/history", key: "history" },
  { href: "/progress", key: "progress" },
  { href: "/plans", key: "plans" },
  { href: "/profile", key: "profile" },
] as const

/**
 * Member nav link row. Splits out as a Client Component so we can read the
 * pathname and highlight the active link. A 2px transparent border is on
 * every link so toggling the active border doesn't shift layout.
 */
export function MemberNavLinks() {
  const t = useTranslations("nav")
  const pathname = usePathname()

  return (
    <nav className="-mx-1 ml-1 flex flex-1 items-center gap-1 self-stretch overflow-x-auto px-1 text-sm">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(link.href + "/")
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
