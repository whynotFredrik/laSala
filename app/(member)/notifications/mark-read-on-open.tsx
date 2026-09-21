"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { markAllReadAction } from "./actions"

/**
 * Opening the inbox marks everything as read (after the page has rendered
 * with the unread highlights, so the member still sees what was new).
 */
export function MarkReadOnOpen({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!hasUnread) return
    const timer = setTimeout(async () => {
      await markAllReadAction()
      router.refresh()
    }, 1500)
    return () => clearTimeout(timer)
  }, [hasUnread, router])
  return null
}
