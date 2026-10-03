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
 *   - a "Mută în…" dropdown of candidate sessions (within the next ~14
 *     days, with spots available); picking one fires the reschedule
 *     action. By default only the same trainer's sessions are offered;
 *     the "show other trainers" switch opens the list to everyone — for
 *     when a trainer is away and the member has to be moved to a
 *     colleague's slot. Same-trainer sessions always come first.
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
  const [allTrainers, setAllTrainers] = useState(false)

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
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={allTrainers}
          onChange={(e) => {
            setAllTrainers(e.target.checked)
            setSelected({})
          }}
        />
        {t("showOtherTrainers")}
      </label>
      <ul className="space-y-3">
        {bookings.map((b) => {
          // Candidates: a different session with spots left. Same trainer
          // only unless the switch is on; same trainer first either way.
          const sameTrainer = (c: CandidateSession) =>
            b.trainer == null || c.trainer == null || c.trainer === b.trainer
          const compatible = candidates
            .filter(
              (c) =>
                c.id !== b.sessionId &&
                c.spotsLeft > 0 &&
                (allTrainers || sameTrainer(c)),
            )
            .sort((x, y) => {
              const sx = sameTrainer(x) ? 0 : 1
              const sy = sameTrainer(y) ? 0 : 1
              return sx !== sy ? sx - sy : x.startAt.localeCompare(y.startAt)
            })

          // Base UI's Select.Value shows the raw value (a session id) unless
          // the root knows the items' labels — hand them over.
          const items = compatible.map((c) => ({
            value: c.id,
            label: `${formatStudio(c.startAt, "EEE d MMM, HH:mm")}${
              c.trainer ? ` · ${c.trainer}` : ""
            } · ${c.spotsLeft} ${t("spotsLeftShort")}`,
          }))

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
                  items={items}
                  value={selected[b.id] ?? ""}
                  onValueChange={(v) =>
                    setSelected((prev) => ({ ...prev, [b.id]: v ?? "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("pickTargetSession")} />
                  </SelectTrigger>
                  <SelectContent>
                    {compatible.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        {allTrainers
                          ? t("noCompatibleSessions")
                          : t("noSameTrainerSessions")}
                      </SelectItem>
                    ) : (
                      items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
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
    </div>
  )
}
