import { NextResponse, type NextRequest } from "next/server"

/**
 * Lightweight route gating for middleware. Runs in Vercel's Edge runtime,
 * which excludes Node-only APIs (no `__dirname`, no `fs`, etc.). For that
 * reason we deliberately do NOT import `@supabase/ssr` here — its current
 * transitive dependency graph trips on `__dirname` when bundled for Edge.
 *
 * Strategy:
 *
 * - Cheap cookie-presence check tells us whether *some* Supabase session
 *   cookie is set. That's enough to redirect anonymous users away from
 *   protected routes and authenticated users away from auth pages.
 * - Real validation (decoding the JWT, role lookup, RLS) happens in server
 *   components and server actions where `@supabase/ssr` works fine —
 *   `lib/auth/get-user.ts` (`requireUser` / `requireAdmin`) is the
 *   authoritative gate.
 *
 * This is consistent with CLAUDE.md hard rule #2 — we never trust the
 * client; the cookie just hints at "is signed in" so we don't even bounce
 * back to the login page mid-flow. The role check still happens
 * server-side, in `app/admin/layout.tsx`.
 */
export async function updateSession(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))

  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"

  const isProtectedRoute =
    pathname.startsWith("/home") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/progress") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/plans") ||
    pathname.startsWith("/admin")

  // Logged-in users hitting auth pages → home
  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Anonymous users hitting protected routes → sign-in (with redirect-back)
  if (!hasSession && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
