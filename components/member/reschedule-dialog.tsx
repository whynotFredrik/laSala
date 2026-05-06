"use client"

import { useState, useTransition } from "react"
import { format, parseISO } from "date-fns"
import { ro } from "date-fns/locale"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { rescheduleBookingAction } from "@/app/(member)/book/actions"

export type CandidateSession = {
  id: string
  session_date: string
  start_at: string
  spots_left: number
  full: boolean
  class_name: string | null
}

/**
 * Reschedule modal. Shows the candidate sessions that the parent server
 * component pre-filtered (already unlocked, not in the past, not the same
 * session, ≤7 days out by convention). The user picks one and we call the
 * Postgres `reschedule_booking` function.
 */
export function RescheduleDialog({
  bookingId,
  candidates,
}: {
  bookingId: string
  candidates: CandidateSession[]
}) {
  const t = useTranslations("booking")
  const tErrors = useTranslations("bookingErrors")
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Group by day for display.
  const byDay = new Map<string, CandidateSession[]>()
  for (const c of candidates) {
    const arr = byDay.get(c.session_date) ?? []
    arr.push(c)
    byDay.set(c.session_date, arr)
  }
  const sortedDays = Array.from(byDay.keys()).sort()

  const submit = () => {
    if (!selected) return
    start(async () => {
      const result = await rescheduleBookingAction(bookingId, selected)
      if (result.status === "error") {
        toast.error(tErrors(result.message))
      } else {
        toast.success(t("rescheduleSuccess"))
        setOpen(false)
        setSelected(null)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {t("rescheduleBooking")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("rescheduleBooking")}</DialogTitle>
          <DialogDescription>{t("reschedulePickNew")}</DialogDescription>
        </DialogHeader>

        {sortedDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("noSessionsForDay")}
          </p>
        ) : (
          <div className="space-y-4">
            {sortedDays.map((day) => {
              const list = byDay.get(day)!
              const date = parseISO(day)
              return (
                <section key={day} className="space-y-2">
                  <p className="text-sm font-medium capitalize">
                    {format(date, "EEEE, d MMMM", { locale: ro })}
                  </p>
                  <ul className="space-y-1">
                    {list.map((c) => {
                      const start = new Date(c.start_at)
                      return (
                        <li key={c.id}>
                          <label className="flex items-center gap-2 rounded border p-2 text-sm hover:bg-muted/50">
                            <input
                              type="radio"
                              name="reschedule-target"
                              value={c.id}
                              disabled={c.full}
                              checked={selected === c.id}
                              onChange={() => setSelected(c.id)}
                            />
                            <span className="font-medium">
                              {format(start, "HH:mm")}
                            </span>
                            {c.class_name ? (
                              <span className="text-muted-foreground">
                                · {c.class_name}
                              </span>
                            ) : null}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {c.full
                                ? t("full")
                                : `${c.spots_left} ${t("spotsLeft")}`}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!selected || pending}
          >
            {t("confirm")}
          </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
