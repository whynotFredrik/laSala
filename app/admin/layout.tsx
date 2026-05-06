import type { ReactNode } from "react"

import { AdminNav } from "@/components/admin/admin-nav"
import { Toaster } from "@/components/ui/sonner"
import { requireAdmin } from "@/lib/auth/get-user"

/**
 * Admin shell. Middleware already gates `/admin/*`; we re-check here for
 * defense-in-depth (CLAUDE.md hard rule #2 — re-check role server-side
 * even when middleware already gated the route).
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-muted/20">
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <Toaster richColors position="top-center" />
    </div>
  )
}
