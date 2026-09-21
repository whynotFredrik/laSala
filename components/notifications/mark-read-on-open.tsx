"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Opening an inbox marks everything as read (after the page has rendered
 * with the unread highlights, so the reader still sees what was new).
 */
export function MarkReadOnOpen({
  hasUnread,
  action,
}: {
  hasUnread: boolean
  action: () => Promise<void>
}) {
  const router = useRouter()
  useEffect(() => {
    if (!hasUnread) return
    const timer = setTimeout(async () => {
      await action()
      router.refresh()
    }, 1500)
    return () => clearTimeout(timer)
  }, [hasUnread, action, router])
  return null
}
