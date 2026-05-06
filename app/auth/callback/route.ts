import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * OAuth / magic-link callback. Supabase redirects here after the user clicks
 * a confirmation link or returns from a provider. We exchange the `code` for
 * a session and forward the user on.
 *
 * - `next` query param: where to land after auth (defaults to /home).
 * - `type` query param: 'recovery' for password reset → /reset-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const type = searchParams.get("type")
  const nextParam = searchParams.get("next") ?? "/home"

  // Only allow internal redirects.
  const next = nextParam.startsWith("/") ? nextParam : "/home"

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const target = type === "recovery" ? "/reset-password" : next
      return NextResponse.redirect(`${origin}${target}`)
    }
  }

  // Something went wrong — bounce to sign-in with a flag so the page can
  // surface a friendly message.
  return NextResponse.redirect(`${origin}/sign-in?error=callback`)
}
