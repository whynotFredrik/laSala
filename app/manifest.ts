import type { MetadataRoute } from "next"

import { BUSINESS } from "@/lib/constants"

/**
 * PWA manifest. The slate base color from `app/globals.css` is roughly
 * #020817 in dark mode / #ffffff in light. We pin background to the light
 * value so the splash screen on iOS/Android matches a fresh launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BUSINESS.name,
    short_name: "Lasala",
    description: `${BUSINESS.tagline}. Rezervări și abonamente pentru ${BUSINESS.name}.`,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    lang: "ro",
    dir: "ltr",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
