import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Relative path so the Vercel Edge bundler doesn't choke on the `@/` alias
// when tracing imports from the middleware boundary.
import type { Database } from "./database.types"

/**
 * Refreshes the Supabase auth session on every request and forwards the
 * (possibly rotated) cookies on the response. Also enforces route gating:
 *
 * - /sign-in, /sign-up, /forgot-password, /reset-password are public; an
 *   already-authenticated user is bounced to /home.
 * - /home, /book, /history, /progress, /profile, /plans, /admin/* require
 *   a session; unauthenticated requests are redirected to /sign-in.
 * - /admin/* additionally requires the caller's profiles.role === 'admin'.
 *
 * Per CLAUDE.md hard rule #2, role is read from the database with the user's
 * own session, not trusted from the client.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // IMPORTANT: do not run any Supabase code between createServerClient and
  // getUser — it triggers session refresh which writes the rotated cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const isAdminRoute = pathname.startsWith("/admin")

  // Logged-in users hitting auth pages → home
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Anonymous users hitting protected routes → sign-in (with redirect-back)
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Admin guard — re-check role server-side, never trust the client
  if (user && isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/home"
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  return response
}
