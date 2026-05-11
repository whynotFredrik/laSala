import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-12", //  48px
  md: "size-14", //  56px (matches the h-14 sticky header)
  lg: "size-16", //  64px
} as const

/**
 * Brand mark. Just the icon — no wordmark text. The icon SVG carries its
 * own rounded corners so we don't apply additional rounding here.
 *
 * Renders an `<a>` so the logo is always a link back home.
 */
export function Logo({
  href = "/",
  size = "md",
  className,
}: {
  href?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center", className)}
      aria-label="Lasala Studio"
    >
      <Image
        src="/icon.svg"
        alt="Lasala Studio"
        width={64}
        height={64}
        className={cn(SIZES[size], "block")}
        priority
      />
    </Link>
  )
}
