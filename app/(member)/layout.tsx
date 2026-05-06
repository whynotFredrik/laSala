import type { ReactNode } from "react"

import { MemberNav } from "@/components/member/member-nav"
import { Toaster } from "@/components/ui/sonner"
import { requireUser } from "@/lib/auth/get-user"

/**
 * Shell for the (member) route group. We `requireUser()` here as the
 * authoritative auth gate for every authenticated page. If the visitor
 * isn't signed in, `requireUser` redirects them to /sign-in.
 */
export default async function MemberLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireUser()
  return (
    <div className="min-h-screen bg-muted/20">
      <MemberNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
