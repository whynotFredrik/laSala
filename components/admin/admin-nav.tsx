import { AdminNavLinks } from "@/components/admin/admin-nav-links"
import { Logo } from "@/components/brand/logo"
import { SignOutButton } from "@/components/member/sign-out-button"

/**
 * Top nav for admin pages. Single-row layout — the link group scrolls
 * horizontally on narrow viewports instead of wrapping. The "ADMIN" label
 * collapses to just the logo on very narrow screens.
 */
export function AdminNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Logo href="/admin" size="md" />
        <span className="hidden text-sm font-semibold uppercase tracking-wider text-primary sm:inline">
          Admin
        </span>
        <AdminNavLinks />
        <SignOutButton />
      </div>
    </header>
  )
}
