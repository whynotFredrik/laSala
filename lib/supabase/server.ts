import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/supabase/database.types"

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads and writes the auth cookie via Next's cookie store. Cookie
 * writes from a Server Component are silently ignored — Next.js forbids them
 * there, and the `setAll` is a no-op in that context.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components can't set cookies. Middleware refreshes the
            // session, so this is safe to swallow.
          }
        },
      },
    },
  )
}
