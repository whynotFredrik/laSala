import type { NextRequest } from "next/server"

// Relative import — Vercel's Edge bundler doesn't always resolve the `@/`
// alias from the root middleware boundary. The alias works fine inside
// app/, components/, etc.; it's specifically the middleware compilation
// step that has trouble.
import { updateSession } from "./lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js assets)
     * - favicon.ico, image files (public)
     * - api/* (route handlers manage their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
