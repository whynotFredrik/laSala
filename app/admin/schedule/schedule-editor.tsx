"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

const TRAINERS = ["Eugen", "Marina", "Ana"] as const

export type ScheduleSlot = {
  id: string
  day_of_week: number
  start_hour: number
  start_minute: number
  duration_min: number
  capacity: number
  is_enabled: boolean
  class_id: string | null
  trainer: (typeof TRAINERS)[number] | null
}

type Draft = {
  id?: string
  dayOfWeek: number
  startHour: number
  durationMin: number
  capacity: number
  trainer: (typeof TRAINERS)[number]
  isEnabled: boolean
}

function emptyDraft(): Draft {
  return {
    dayOfWeek: 0,
    startHour: 18,
    durationMin: 60,
    capacity: 6,
    trainer: "Eugen",
    isEnabled: true,
  }
}

function slotToDraft(s: ScheduleSlot): Draft {
  return {
    id: s.id,
    dayOfWeek: s.day_of_week,
    startHour: s.start_hour,
    durationMin: s.duration_min,
    capacity: s.capacity,
    trainer: s.trainer ?? "Eugen",
    isEnabled: s.is_enabled,
  }
}

export function ScheduleEditor({ slots }: { slots: ScheduleSlot[] }) {
  const t = useTranslations("adminSchedule")
  const tDays = useTranslations("days")
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [editing, setEditing] = useState<Draft | null>(null)

  const grouped = new Map<number, ScheduleSlot[]>()
  for (const day of DAYS) grouped.set(day.value, [])
  for (const s of slots) grouped.get(s.day_of_week)?.push(s)
  for (const list of grouped.values()) {
    list.sort((a, b) => a.start_hour - b.start_hour)
  }

  const persist = (input: Draft) =>
    start(async () => {
      const res = await upsertScheduleSlotAction({
        ...input,
        startMinute: 0, // all sessions start on the hour
      })
      if (res.status === "error") toast.error(t("saveFailed"))
      else {
        toast.success(t("saved"))
        if (!input.id) setDraft(emptyDraft()) // reset add form
        setEditing(null)
      }
    })

  const toggle = (slot: ScheduleSlot) =>
    persist({
      ...slotToDraft(slot),
      isEnabled: !slot.is_enabled,
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
            placeholder={t("hour")}
          />
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
          <select
            className="h-9 rounded border bg-background px-2 text-sm"
            value={draft.trainer}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                trainer: e.target.value as (typeof TRAINERS)[number],
              }))
            }
          >
            {TRAINERS.map((tr) => (
              <option key={tr} value={tr}>
                {tr}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() => persist(draft)}
            disabled={pending}
          >
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
                      <span className="font-mono font-semibold">
                        {s.start_hour.toString().padStart(2, "0")}:00
                      </span>{" "}
                      <span className="text-muted-foreground">
                        · {s.duration_min}min · {s.capacity}{" "}
                        {t("capacityShort")}
                      </span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                        {s.trainer ?? "—"}
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
                        onClick={() => setEditing(slotToDraft(s))}
                      >
                        {t("edit")}
                      </Button>
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

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editSlot")}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("day")}</Label>
                <select
                  className="h-9 w-full rounded border bg-background px-2 text-sm"
                  value={editing.dayOfWeek}
                  onChange={(e) =>
                    setEditing((d) =>
                      d ? { ...d, dayOfWeek: Number(e.target.value) } : d,
                    )
                  }
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {tDays(d.key)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("hour")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={editing.startHour}
                    onChange={(e) =>
                      setEditing((d) =>
                        d ? { ...d, startHour: Number(e.target.value) } : d,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("minutes")}</Label>
                  <Input
                    type="number"
                    min={15}
                    max={240}
                    value={editing.durationMin}
                    onChange={(e) =>
                      setEditing((d) =>
                        d
                          ? { ...d, durationMin: Number(e.target.value) }
                          : d,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("capacity")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={editing.capacity}
                    onChange={(e) =>
                      setEditing((d) =>
                        d ? { ...d, capacity: Number(e.target.value) } : d,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("trainer")}</Label>
                  <select
                    className="h-9 w-full rounded border bg-background px-2 text-sm"
                    value={editing.trainer}
                    onChange={(e) =>
                      setEditing((d) =>
                        d
                          ? {
                              ...d,
                              trainer: e.target
                                .value as (typeof TRAINERS)[number],
                            }
                          : d,
                      )
                    }
                  >
                    {TRAINERS.map((tr) => (
                      <option key={tr} value={tr}>
                        {tr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => editing && persist(editing)}
              disabled={pending}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
