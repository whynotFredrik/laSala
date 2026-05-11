"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { addRecurringAction } from "./actions"

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type SlotOption = {
  id: string
  day_of_week: number
  start_hour: number
  start_minute: number
  trainer: string | null
  capacity: number
}

export function AddRecurring({
  userId,
  slots,
}: {
  userId: string
  slots: SlotOption[]
}) {
  const t = useTranslations("adminRecurring")
  const tDays = useTranslations("days")
  const [selected, setSelected] = useState<string>("")
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      if (!selected) return
      const res = await addRecurringAction({
        userId,
        scheduleTemplateId: selected,
      })
      if (res.status === "error") toast.error(t(res.message as "save_failed"))
      else {
        toast.success(t("added"))
        setSelected("")
      }
    })

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("noAvailableSlots")}
      </p>
    )
  }

  return (
    <div className="flex gap-2">
      <select
        className="h-9 flex-1 rounded border bg-background px-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">{t("pickSlot")}</option>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>
            {tDays(DAY_KEYS[s.day_of_week]!)} ·{" "}
            {s.start_hour.toString().padStart(2, "0")}:
            {s.start_minute.toString().padStart(2, "0")} · {s.trainer ?? "—"}
          </option>
        ))}
      </select>
      <Button
        type="button"
        onClick={submit}
        disabled={pending || !selected}
        size="sm"
      >
        {t("add")}
      </Button>
    </div>
  )
}
