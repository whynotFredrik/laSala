/* Lasala Fitness Studio — minimal service worker.
 *
 * Goals:
 *   - When offline, the app icon should still launch a usable shell instead
 *     of the dinosaur. We serve the cached `/offline.html` for any
 *     navigation request that fails.
 *   - Static assets (Next's chunked JS/CSS, our SVG icon) are cached on
 *     first hit so subsequent loads are instant.
 *   - We do NOT cache HTML or API responses — those should always be fresh
 *     and authenticated.
 *
 * Bumping CACHE_VERSION invalidates the previous cache.
 */

const CACHE_VERSION = "v1"
const RUNTIME_CACHE = `lasala-runtime-${CACHE_VERSION}`
const SHELL_CACHE = `lasala-shell-${CACHE_VERSION}`
const SHELL_URLS = ["/offline.html", "/icon.svg", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter(
            (k) => k !== RUNTIME_CACHE && k !== SHELL_CACHE,
          )
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  // Only handle GET; never cache mutations.
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache API or auth surface — they need fresh, authenticated round-trips.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return
  }

  // Navigation requests: try network, fall back to cached offline shell.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request)
        } catch {
          const cache = await caches.open(SHELL_CACHE)
          const offline = await cache.match("/offline.html")
          return (
            offline ?? new Response("Offline", { status: 503 })
          )
        }
      })(),
    )
    return
  }

  // Static assets: cache-first with background refresh.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE)
        const cached = await cache.match(request)
        const fetchAndPut = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
          .catch(() => cached ?? Response.error())
        return cached ?? fetchAndPut
      })(),
    )
  }
})
