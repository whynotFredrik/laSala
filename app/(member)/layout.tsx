import type { ReactNode } from "react"

import { MemberNav } from "@/components/member/member-nav"
import { Toaster } from "@/components/ui/sonner"

/**
 * Shell for the (member) route group. Middleware already gated access — by
 * the time we render here, we know there's an authenticated user.
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20">
      <MemberNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
