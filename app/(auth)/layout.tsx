import type { ReactNode } from "react"

/**
 * Layout for unauthenticated routes (sign-in, sign-up, forgot-password,
 * reset-password). Centers a single card on screen.
 *
 * "If logged in, redirect to /home" is enforced per-page (in sign-in,
 * sign-up, forgot-password) rather than here, because /reset-password
 * deliberately runs with an authenticated recovery session.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
