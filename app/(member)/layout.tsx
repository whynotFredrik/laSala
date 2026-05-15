import type { ReactNode } from "react"

import { MemberNav } from "@/components/member/member-nav"
import { Toaster } from "@/components/ui/sonner"
import { requireMember } from "@/lib/auth/get-user"

/**
 * Shell for the (member) route group. `requireMember()` gates the route:
 * anonymous visitors get sent to /sign-in, admins get sent to /admin
 * (they have no business in the member experience).
 */
export default async function MemberLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireMember()
  return (
    <div className="min-h-screen bg-muted/20">
      <MemberNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
