import { getRequestConfig } from "next-intl/server"

/**
 * Single-locale launch (Romanian). The shape lets us add `en` later without
 * changing the call sites — they read the locale from the request config.
 */
const DEFAULT_LOCALE = "ro" as const

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "Europe/Bucharest",
  }
})
