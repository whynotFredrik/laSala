"use client"

import { useActionState, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RULES } from "@/lib/constants"

import { allocateFreezeAction, type FreezeAdminState } from "./actions"

const initialState: FreezeAdminState = { status: "idle" }

export type FreezeMemberOption = {
  id: string
  label: string
  remainingDays: number
}

export default function AllocateFreezeForm({
  members,
  today,
}: {
  members: FreezeMemberOption[]
  /** Studio-local today, YYYY-MM-DD (earliest allowed start). */
  today: string
}) {
  const t = useTranslations("adminFreezes")
  const [state, action, pending] = useActionState(
    allocateFreezeAction,
    initialState,
  )
  const [userId, setUserId] = useState("")
  const selected = members.find((m) => m.id === userId)

  useEffect(() => {
    if (state.status === "ok") {
      toast.success(t("allocated"))
      setUserId("")
    } else if (state.status === "error") {
      toast.error(t(`errors.${state.message}` as "errors.unknown"))
    }
  }, [state, t])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-3">
          <Label htmlFor="freezeMember">{t("member")}</Label>
          <Select
            value={userId}
            onValueChange={(v: string | null) => setUserId(v ?? "")}
          >
            <SelectTrigger id="freezeMember" className="w-full">
              <SelectValue>
                {(v: string | null) =>
                  members.find((m) => m.id === v)?.label ?? t("pickMember")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label} · {t("daysLeft", { days: m.remainingDays })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <p className="text-xs text-muted-foreground">
              {t("memberRemaining", { days: selected.remainingDays })}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="freezeStart">{t("startDate")}</Label>
          <Input
            id="freezeStart"
            name="startDate"
            type="date"
            min={today}
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="freezeDuration">{t("duration")}</Label>
          <Input
            id="freezeDuration"
            name="durationDays"
            type="number"
            inputMode="numeric"
            min={RULES.FREEZE_MIN_DAYS}
            max={RULES.FREEZE_MAX_DAYS}
            defaultValue={7}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("allocateHint")}</p>
      <Button type="submit" disabled={pending || !userId}>
        {t("allocateSubmit")}
      </Button>
    </form>
  )
}
