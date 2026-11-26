"use client"

import { format, parseISO } from "date-fns"
import { ro as roDates } from "date-fns/locale"
import { useActionState, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { ro } from "react-day-picker/locale"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { closeDaysAction, type ClosureState } from "./actions"

const initialState: ClosureState = { status: "idle" }

/**
 * Pick one or more days on a calendar and close the studio on them.
 * Days already closed are marked and cannot be picked again (reopen them
 * from the list instead).
 */
export default function CloseDaysForm({
  today,
  closedDates,
}: {
  /** Studio-local today, YYYY-MM-DD (earliest day that can be closed). */
  today: string
  /** Upcoming closed days, YYYY-MM-DD. */
  closedDates: string[]
}) {
  const t = useTranslations("adminClosures")
  const [state, action, pending] = useActionState(closeDaysAction, initialState)
  const [selected, setSelected] = useState<Date[]>([])
  const [reason, setReason] = useState("")

  // Calendar days are local-midnight Dates; YYYY-MM-DD round-trips exactly.
  const closed = useMemo(() => closedDates.map((d) => parseISO(d)), [closedDates])
  const todayDate = useMemo(() => parseISO(today), [today])
  const isoDates = selected
    .map((d) => format(d, "yyyy-MM-dd"))
    .sort()

  useEffect(() => {
    if (state.status === "ok") {
      toast.success(
        t("closed", {
          days: state.days,
          cancelled: state.cancelled,
          extended: state.extended,
        }),
      )
      setSelected([])
      setReason("")
    } else if (state.status === "error") {
      toast.error(t(`errors.${state.message}` as "errors.unknown"))
    }
  }, [state, t])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="dates" value={JSON.stringify(isoDates)} />
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <Calendar
          mode="multiple"
          locale={ro}
          weekStartsOn={1}
          selected={selected}
          onSelect={(days) => setSelected(days ?? [])}
          disabled={[{ before: todayDate }, ...closed]}
          modifiers={{ closed }}
          modifiersClassNames={{
            closed:
              "[&>button]:bg-destructive/15 [&>button]:text-destructive [&>button]:line-through [&>button]:opacity-100",
          }}
          defaultMonth={todayDate}
          className="rounded-lg border [--cell-size:--spacing(10)]"
        />
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("selectedTitle")}</p>
            {isoDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("selectedNone")}
              </p>
            ) : (
              <ul className="text-sm">
                {isoDates.map((d) => (
                  <li key={d} className="first-letter:uppercase">
                    {format(parseISO(d), "EEEE, d MMMM yyyy", {
                      locale: roDates,
                    })}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="closureReason">{t("reason")}</Label>
            <Input
              id="closureReason"
              name="reason"
              maxLength={200}
              placeholder={t("reasonPlaceholder")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("closeHint")}</p>
          <Button type="submit" disabled={pending || isoDates.length === 0}>
            {t("closeSubmit", { count: isoDates.length })}
          </Button>
        </div>
      </div>
    </form>
  )
}
