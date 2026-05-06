import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  experimental: {
    // Allows our middleware to opt into Node.js runtime instead of Edge.
    // We need this because the next-intl plugin's transform leaks code that
    // references `__dirname` (a Node global) into the middleware bundle —
    // running middleware on Node runtime makes that a non-issue.
    nodeMiddleware: true,
  },
}

export default withNextIntl(nextConfig)
