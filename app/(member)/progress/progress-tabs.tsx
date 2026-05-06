"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/progress/weight", key: "weight" },
  { href: "/progress/nutrition", key: "nutrition" },
  { href: "/progress/photos", key: "photos" },
  { href: "/progress/dietary", key: "dietary" },
  { href: "/progress/tdee", key: "tdee" },
] as const

export function ProgressTabs() {
  const t = useTranslations("progress")
  const pathname = usePathname()

  return (
    <nav className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
