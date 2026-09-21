"use client"

import { useMemo, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ALL_TRAINERS, type Trainer } from "@/lib/constants"

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

/**
 * Pin a member to a template slot. Slots are grouped per trainer behind a
 * tab switcher; the default tab is the first trainer serving the member's
 * sex, but the admin can pick any trainer.
 */
export function AddRecurring({
  userId,
  slots,
  defaultTrainer,
}: {
  userId: string
  slots: SlotOption[]
  defaultTrainer: Trainer | null
}) {
  const t = useTranslations("adminRecurring")
  const tDays = useTranslations("days")
  const [trainer, setTrainer] = useState<Trainer>(
    defaultTrainer ?? ALL_TRAINERS[0]!,
  )
  const [selected, setSelected] = useState<string>("")
  const [pending, start] = useTransition()

  const visible = useMemo(
    () => slots.filter((s) => s.trainer === trainer),
    [slots, trainer],
  )

  const submit = () =>
    start(async () => {
      if (!selected) return
      const res = await addRecurringAction({
        userId,
        scheduleTemplateId: selected,
      })
      if (res.status === "error") {
        toast.error(t(res.message as "save_failed"))
        return
      }
      const { booked, skipped } = res
      toast.success(t("added"), {
        description:
          booked > 0 || skipped > 0
            ? t("addedOutcome", { booked, skipped })
            : undefined,
      })
      setSelected("")
    })

  return (
    <div className="space-y-3">
      <Tabs
        value={trainer}
        onValueChange={(v) => {
          setTrainer(v as Trainer)
          setSelected("")
        }}
      >
        <TabsList aria-label={t("trainerTabs")}>
          {ALL_TRAINERS.map((tr) => (
            <TabsTrigger key={tr} value={tr}>
              {tr}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("noSlotsForTrainer", { trainer })}
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            className="h-9 flex-1 rounded border bg-background px-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">{t("pickSlot")}</option>
            {visible.map((s) => (
              <option key={s.id} value={s.id}>
                {tDays(DAY_KEYS[s.day_of_week]!)} ·{" "}
                {s.start_hour.toString().padStart(2, "0")}:
                {s.start_minute.toString().padStart(2, "0")}
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
      )}
    </div>
  )
}
