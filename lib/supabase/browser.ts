import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/database.types"

/**
 * Supabase client for Client Components. Safe to call from the browser — only
 * uses the public anon key and relies on RLS for authorization.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
