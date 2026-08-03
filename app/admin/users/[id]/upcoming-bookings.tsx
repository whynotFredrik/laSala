"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatStudio } from "@/lib/booking/format"

import {
  adminCancelBookingAction,
  adminMoveBookingAction,
} from "./actions"

type Booking = {
  id: string
  sessionId: string
  startAt: string
  className: string | null
  trainer: string | null
}

type CandidateSession = {
  id: string
  startAt: string
  className: string | null
  trainer: string | null
  spotsLeft: number
}

/**
 * Lists a member's upcoming bookings. Each row has:
 *   - a "Mută în…" dropdown of candidate sessions (matching trainer, within
 *     the next ~14 days, with spots available); picking one fires the
 *     reschedule action.
 *   - a "Anulează" button for direct cancellation (admin can bypass the
 *     3-hour window).
 */
export function UpcomingBookings({
  userId,
  bookings,
  candidates,
}: {
  userId: string
  bookings: Booking[]
  candidates: CandidateSession[]
}) {
  const t = useTranslations("adminUsers")
  const tErrors = useTranslations("bookingErrors")
  const [pending, start] = useTransition()
  // Per-booking selected target session id — keeps the dropdown reset cleanly
  // between rows.
  const [selected, setSelected] = useState<Record<string, string>>({})

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("noUpcomingBookings")}</p>
    )
  }

  const handleMove = (booking: Booking) => {
    const newSessionId = selected[booking.id]
    if (!newSessionId) {
      toast.error(t("pickTargetSession"))
      return
    }
    if (newSessionId === booking.sessionId) {
      toast.error(t("sameSessionPicked"))
      return
    }
    start(async () => {
      const res = await adminMoveBookingAction({
        userId,
        bookingId: booking.id,
        newSessionId,
      })
      if (res.status === "error") {
        toast.error(tErrors(res.message))
      } else {
        toast.success(t("bookingMoved"))
        setSelected((prev) => {
          const next = { ...prev }
          delete next[booking.id]
          return next
        })
      }
    })
  }

  const handleCancel = (booking: Booking) => {
    if (!confirm(t("confirmCancel"))) return
    start(async () => {
      const res = await adminCancelBookingAction({
        userId,
        bookingId: booking.id,
      })
      if (res.status === "error") {
        toast.error(tErrors(res.message))
      } else {
        toast.success(t("bookingCancelled"))
      }
    })
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        // Candidates compatible with this booking: must be different,
        // matching trainer when known.
        const compatible = candidates.filter(
          (c) =>
            c.id !== b.sessionId &&
            (b.trainer == null ||
              c.trainer == null ||
              c.trainer === b.trainer) &&
            c.spotsLeft > 0,
        )

        return (
          <li key={b.id} className="space-y-2 rounded border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium">
                {b.className ?? "Sesiune"} ·{" "}
                {formatStudio(b.startAt, "EEEE d MMM, HH:mm")}
              </p>
              {b.trainer ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {b.trainer}
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Select
                value={selected[b.id] ?? ""}
                onValueChange={(v) =>
                  setSelected((prev) =>
                    v == null ? prev : { ...prev, [b.id]: v },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("pickTargetSession")} />
                </SelectTrigger>
                <SelectContent>
                  {compatible.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {t("noCompatibleSessions")}
                    </SelectItem>
                  ) : (
                    compatible.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {formatStudio(c.startAt, "EEE d MMM, HH:mm")}
                        {c.trainer ? ` · ${c.trainer}` : ""}
                        {` · ${c.spotsLeft} ${t("spotsLeftShort")}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={() => handleMove(b)}
                disabled={pending || !selected[b.id]}
              >
                {t("move")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => handleCancel(b)}
                disabled={pending}
              >
                {t("cancel")}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
