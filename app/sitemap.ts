import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/constants"

const SITE_URL = siteUrl()

/**
 * Public sitemap. Member and admin pages are gated by middleware and don't
 * belong in the index — we list only the marketing surface.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/sign-up`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/sign-in`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ]
}
