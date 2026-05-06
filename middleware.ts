import { NextResponse, type NextRequest } from "next/server"

/**
 * Middleware. Runs on the Node.js runtime (opted in via
 * `experimental.nodeMiddleware` in `next.config.ts`) so that the next-intl
 * plugin's bundle transform — which references `__dirname` — works.
 *
 * Strategy is still the same lightweight cookie-presence routing.
 * Authoritative auth/role checks happen in server components
 * (`lib/auth/get-user.ts` → `requireUser` / `requireAdmin`).
 */

export const config = {
  // Skip Next internals, the public asset folder, /api, and /auth routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
  // Plain string — Next's middleware-config static analyzer rejects
  // `as const` assertions here.
  runtime: "nodejs",
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
