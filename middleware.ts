// Intentionally a no-op. Auth gating is enforced server-side in layouts:
//   - app/(member)/layout.tsx        → requireUser()
//   - app/admin/layout.tsx           → requireAdmin()
// Auth pages (/sign-in, /sign-up, /forgot-password) check for a session
// at the top of each page and redirect signed-in visitors to /home.
//
// No `config` export — Vercel's route validator was rejecting a `matcher`
// array entry. Without `config`, this middleware matches everything but
// does literally nothing on every request.

import { NextResponse, type NextRequest } from "next/server"

export function middleware(_request: NextRequest) {
  return NextResponse.next()
}
