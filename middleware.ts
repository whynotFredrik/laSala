import { NextResponse, type NextRequest } from "next/server"

/**
 * Edge middleware. Pure cookie-presence routing — does NOT import any of our
 * own modules so the Edge bundle stays minimal and we sidestep any
 * `__dirname` / Node-API reference that may live in transitive deps.
 *
 * Authoritative auth/role checks happen in server components
 * (`lib/auth/get-user.ts` → `requireUser` / `requireAdmin`) which run in
 * Node runtime where `@supabase/ssr` works fine.
 */

export const config = {
  // Skip Next internals, the public asset folder, /api, and /auth routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
}

export function middleware(request: NextRequest) {
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

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (!hasSession && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
