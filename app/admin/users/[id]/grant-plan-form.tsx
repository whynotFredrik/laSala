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

import { grantPlanAction, type UserAdminState } from "./actions"

const initialState: UserAdminState = { status: "idle" }

export type GrantableTier = {
  id: string
  name_ro: string
  sessions_per_month: number
  duration_months: number
}

export function GrantPlanForm({
  userId,
  tiers,
  hasActivePlan,
}: {
  userId: string
  tiers: GrantableTier[]
  hasActivePlan: boolean
}) {
  const t = useTranslations("adminUsers")
  const [state, action, pending] = useActionState(grantPlanAction, initialState)
  const [tierId, setTierId] = useState("")
  const [remaining, setRemaining] = useState("")

  useEffect(() => {
    if (state.status === "ok") toast.success(t("planGranted"))
    else if (state.status === "error")
      toast.error(`${t("error")}: ${state.message}`)
  }, [state, t])

  const pickTier = (id: string | null) => {
    if (id == null) return
    setTierId(id)
    const tier = tiers.find((x) => x.id === id)
    // Default to a full plan; the admin lowers it for members mid-cycle.
    if (tier) setRemaining(String(tier.sessions_per_month * tier.duration_months))
  }

  return (
    <form action={action} className="space-y-3">
      {hasActivePlan ? (
        <p className="text-sm text-muted-foreground">{t("grantReplaces")}</p>
      ) : null}
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tierId">{t("grantTier")}</Label>
          <Select name="tierId" value={tierId} onValueChange={pickTier}>
            <SelectTrigger id="tierId">
              <SelectValue placeholder={t("grantPickTier")} />
            </SelectTrigger>
            <SelectContent>
              {tiers.map((tier) => (
                <SelectItem key={tier.id} value={tier.id}>
                  {tier.name_ro}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("grantStartDate")}</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sessionsRemaining">{t("grantSessionsRemaining")}</Label>
          <Input
            id="sessionsRemaining"
            name="sessionsRemaining"
            type="number"
            inputMode="numeric"
            min={0}
            value={remaining}
            onChange={(e) => setRemaining(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="streakMonth">{t("grantStreakMonth")}</Label>
          <Input
            id="streakMonth"
            name="streakMonth"
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={1}
            required
          />
          <p className="text-xs text-muted-foreground">
            {t("grantStreakHint")}
          </p>
        </div>
      </div>
      <Button type="submit" disabled={pending || !tierId}>
        {t("grantSubmit")}
      </Button>
    </form>
  )
}
