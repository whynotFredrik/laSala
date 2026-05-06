import type { MetadataRoute } from "next"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lasalastudio.ro"

/**
 * robots.txt: search engines may crawl the public marketing surface but we
 * disallow `/admin/*`, the authenticated member areas, and the API surface
 * (cron + webhooks live there).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/sign-in", "/sign-up", "/forgot-password"],
        disallow: [
          "/admin",
          "/admin/",
          "/home",
          "/book",
          "/history",
          "/progress",
          "/profile",
          "/plans",
          "/api/",
          "/auth/",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
