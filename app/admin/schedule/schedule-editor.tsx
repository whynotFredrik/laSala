"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  deleteScheduleSlotAction,
  upsertScheduleSlotAction,
} from "./actions"

const DAYS = [
  { value: 0, key: "monday" },
  { value: 1, key: "tuesday" },
  { value: 2, key: "wednesday" },
  { value: 3, key: "thursday" },
  { value: 4, key: "friday" },
  { value: 5, key: "saturday" },
  { value: 6, key: "sunday" },
] as const

export type ScheduleSlot = {
  id: string
  day_of_week: number
  start_hour: number
  start_minute: number
  duration_min: number
  capacity: number
  is_enabled: boolean
  class_id: string | null
}

export function ScheduleEditor({ slots }: { slots: ScheduleSlot[] }) {
  const t = useTranslations("adminSchedule")
  const tDays = useTranslations("days")
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState({
    dayOfWeek: 0,
    startHour: 18,
    startMinute: 0,
    durationMin: 60,
    capacity: 6,
  })

  const grouped = new Map<number, ScheduleSlot[]>()
  for (const day of DAYS) grouped.set(day.value, [])
  for (const s of slots) grouped.get(s.day_of_week)?.push(s)
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        a.start_hour * 60 +
        a.start_minute -
        (b.start_hour * 60 + b.start_minute),
    )
  }

  const addSlot = () =>
    start(async () => {
      const res = await upsertScheduleSlotAction({
        ...draft,
        startMinute: draft.startMinute as 0 | 15 | 30 | 45,
        isEnabled: true,
      })
      if (res.status === "error") toast.error(t("saveFailed"))
      else toast.success(t("saved"))
    })

  const toggle = (slot: ScheduleSlot) =>
    start(async () => {
      const res = await upsertScheduleSlotAction({
        id: slot.id,
        dayOfWeek: slot.day_of_week,
        startHour: slot.start_hour,
        startMinute: slot.start_minute as 0 | 15 | 30 | 45,
        durationMin: slot.duration_min,
        capacity: slot.capacity,
        classId: slot.class_id,
        isEnabled: !slot.is_enabled,
      })
      if (res.status === "error") toast.error(t("saveFailed"))
    })

  const remove = (id: string) =>
    start(async () => {
      if (!confirm(t("deleteConfirm"))) return
      await deleteScheduleSlotAction(id)
      toast.success(t("deleted"))
    })

  return (
    <div className="space-y-6">
      <section className="rounded border p-3">
        <h3 className="text-sm font-medium">{t("addSlot")}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={draft.dayOfWeek}
            onChange={(e) =>
              setDraft((d) => ({ ...d, dayOfWeek: Number(e.target.value) }))
            }
          >
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {tDays(d.key)}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={0}
            max={23}
            value={draft.startHour}
            onChange={(e) =>
              setDraft((d) => ({ ...d, startHour: Number(e.target.value) }))
            }
            placeholder="HH"
          />
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={draft.startMinute}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                startMinute: Number(e.target.value),
              }))
            }
          >
            {[0, 15, 30, 45].map((m) => (
              <option key={m} value={m}>
                :{m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={15}
            max={240}
            value={draft.durationMin}
            onChange={(e) =>
              setDraft((d) => ({ ...d, durationMin: Number(e.target.value) }))
            }
            placeholder={t("minutes")}
          />
          <Input
            type="number"
            min={1}
            max={50}
            value={draft.capacity}
            onChange={(e) =>
              setDraft((d) => ({ ...d, capacity: Number(e.target.value) }))
            }
            placeholder={t("capacity")}
          />
          <Button type="button" onClick={addSlot} disabled={pending}>
            {t("add")}
          </Button>
        </div>
      </section>

      {DAYS.map((d) => {
        const list = grouped.get(d.value)!
        return (
          <section key={d.value} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {tDays(d.key)}
            </h3>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
            ) : (
              <ul className="divide-y rounded border">
                {list.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 p-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {s.start_hour.toString().padStart(2, "0")}:
                        {s.start_minute.toString().padStart(2, "0")}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        · {s.duration_min}min · {s.capacity}{" "}
                        {t("capacityShort")}
                      </span>
                      {!s.is_enabled ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {t("disabled")}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => toggle(s)}
                      >
                        {s.is_enabled ? t("disable") : t("enable")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => remove(s.id)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
