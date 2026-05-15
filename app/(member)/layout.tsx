import type { ReactNode } from "react"

import { AdminPreviewBanner } from "@/components/admin/preview-banner"
import { MemberNav } from "@/components/member/member-nav"
import { Toaster } from "@/components/ui/sonner"
import { requireMember } from "@/lib/auth/get-user"

/**
 * Shell for the (member) route group. `requireMember()` gates the route:
 * anonymous visitors get sent to /sign-in, admins get sent to /admin
 * (unless they have opted into the admin preview cookie).
 *
 * When an admin is previewing, the AdminPreviewBanner renders at the top
 * with an "Exit preview" button.
 */
export default async function MemberLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireMember()
  return (
    <div className="min-h-screen bg-muted/20">
      <AdminPreviewBanner />
      <MemberNav />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
