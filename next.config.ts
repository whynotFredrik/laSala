import type { NextConfig } from "next"

// next-intl plugin temporarily disabled — investigating whether its build-time
// transform is the source of `__dirname is not defined` in the Edge bundle.
// Re-enable both lines (and the export wrapper below) once the middleware
// build is confirmed clean.
//
// import createNextIntlPlugin from "next-intl/plugin"
// const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  /* config options here */
}

// export default withNextIntl(nextConfig)
export default nextConfig
