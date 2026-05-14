import type { MetadataRoute } from "next"

import { BUSINESS } from "@/lib/constants"

/**
 * PWA manifest. Lists the icons that exist in `public/`:
 *   - icon.svg               vector, used wherever browsers prefer SVG
 *   - icon-192.png           Android home-screen, install dialog
 *   - icon-512.png           Android splash screen
 *   - icon-maskable-512.png  Adaptive icon (safe zone respected)
 *
 * All four are required for Chrome on Android to mint a real WebAPK
 * (signed by Google) instead of falling back to a shortcut that Play
 * Protect flags as unsafe.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BUSINESS.name,
    short_name: "Lasala",
    description: `${BUSINESS.tagline}. Rezervări și abonamente pentru ${BUSINESS.name}.`,
    // Stable identity for the PWA. Forces Chrome to re-mint the WebAPK
    // (with current targetSdkVersion) instead of upgrading the old one
    // that's tripping Play Protect.
    id: "/?source=pwa",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#dc2626",
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
