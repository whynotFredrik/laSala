"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Captures the `beforeinstallprompt` event and shows a small "install" banner
 * when the browser deems the PWA installable. iOS Safari doesn't fire this
 * event — there's a small fallback hint for Apple users.
 *
 * Renders nothing until the event fires (or until iOS hint is shown), so
 * cost is zero on browsers that don't support it.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    const ios =
      /iPhone|iPad|iPod/.test(ua) &&
      // crude standalone check
      !("standalone" in window.navigator && window.navigator.standalone)
    setIsIos(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (dismissed) return null

  if (event) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-lg border bg-background p-3 shadow-lg sm:left-auto">
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm">
            Instalează aplicația pe ecranul principal pentru acces rapid.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              await event.prompt()
              setEvent(null)
            }}
          >
            Instalează
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            aria-label="Închide"
          >
            ×
          </Button>
        </div>
      </div>
    )
  }

  if (isIos) {
    return (
      <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-lg border bg-background p-3 text-sm shadow-lg sm:left-auto">
        <div className="flex items-center gap-3">
          <p className="flex-1">
            Pe iPhone, deschide meniul <span aria-label="Share">⤴</span> și
            apasă{" "}
            <span className="whitespace-nowrap">Adaugă pe ecranul principal</span>
            .
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
          >
            ×
          </Button>
        </div>
      </div>
    )
  }

  return null
}
