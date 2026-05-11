import { Logo } from "@/components/brand/logo"
import { MemberNavLinks } from "@/components/member/member-nav-links"
import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for authenticated member pages. Logo on the left links back to
 * /home, link row scrolls horizontally on narrow screens with the active
 * link underlined, sign-out anchored to the right.
 */
export function MemberNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
        <Logo href="/home" size="md" />
        <MemberNavLinks />
        <SignOutButton />
      </div>
    </header>
  )
}
