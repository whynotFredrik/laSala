// Intentionally a no-op. Auth gating is enforced server-side in layouts:
//   - app/(member)/layout.tsx        → requireUser()
//   - app/admin/layout.tsx           → requireAdmin()
// Auth pages (/sign-in, /sign-up, /forgot-password, /reset-password) check
// for an existing session at the top of each page and redirect to /home.
//
// Reason for keeping the file as a no-op (instead of deleting it): some
// hosts cache the absence of middleware oddly across deploys. A trivial
// pass-through is safer.

import { NextResponse, type NextRequest } from "next/server"

export const config = {
  matcher: [],
}

export function middleware(_request: NextRequest) {
  return NextResponse.next()
}
