"use client"

import { useEffect } from "react"

/**
 * Registers `/sw.js` once on first mount. Only in production — registering
 * a service worker in dev causes weird caching bugs with Turbopack.
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
      return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore — offline shell is best-effort
    })
  }, [])

  return null
}
