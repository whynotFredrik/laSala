import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  experimental: {
    // Opts the middleware into Node.js runtime. The next-intl plugin's
    // transform leaks code that references `__dirname` (a Node global)
    // into the middleware bundle — Node runtime makes that a non-issue.
    //
    // Cast: `nodeMiddleware` is supported at runtime in Next 15.5.x (you
    // can see `✓ nodeMiddleware` in the build experiments list) but the
    // public TypeScript types haven't caught up yet, so we widen here.
    ...({ nodeMiddleware: true } as Record<string, unknown>),
  },
}

export default withNextIntl(nextConfig)
