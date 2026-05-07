import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

const SIZES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const

/**
 * Brand mark. Just the icon — no wordmark text. The icon SVG already
 * contains the brand identity, so adjacent text would be redundant.
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
        width={56}
        height={56}
        className={cn(SIZES[size], "rounded-md")}
        priority
      />
    </Link>
  )
}
