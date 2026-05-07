import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Brand mark + wordmark. Use the `iconOnly` variant on tight headers
 * (member nav on mobile) and the full wordmark on landing / desktop.
 *
 * Renders an `<a>` so the logo is always a link back home.
 */
export function Logo({
  href = "/",
  variant = "wordmark",
  className,
}: {
  href?: string
  variant?: "wordmark" | "icon"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
      aria-label="Lasala Fitness Studio"
    >
      <Image
        src="/icon.svg"
        alt=""
        width={28}
        height={28}
        className="size-7 rounded-md"
        priority
      />
      {variant === "wordmark" ? (
        <span className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight">LASALA</span>
          <span className="text-[10px] font-medium tracking-[0.18em] text-primary">
            FITNESS STUDIO
          </span>
        </span>
      ) : null}
    </Link>
  )
}
