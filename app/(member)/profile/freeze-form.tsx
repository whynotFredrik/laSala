"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { RULES } from "@/lib/constants"

import { freezeMembershipAction, type FreezeState } from "./freeze-actions"

const initialState: FreezeState = { status: "idle" }

/**
 * Earliest date a freeze may start: today + 2 (48-hour rule).
 */
function minStartDate() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10)
}

export function FreezeForm({ remainingDays }: { remainingDays: number }) {
  const t = useTranslations("freeze")
  const tErrors = useTranslations("freezeErrors")
  const [state, action, pending] = useActionState(
    freezeMembershipAction,
    initialState,
  )

  const disabled = remainingDays < RULES.FREEZE_MIN_DAYS

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="startDate">{t("startDate")}</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          min={minStartDate()}
          required
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{t("startDateHint")}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="durationDays">{t("duration")}</Label>
        <Input
          id="durationDays"
          name="durationDays"
          type="number"
          inputMode="numeric"
          min={RULES.FREEZE_MIN_DAYS}
          max={Math.min(remainingDays, RULES.FREEZE_MAX_DAYS)}
          defaultValue={Math.min(remainingDays, RULES.FREEZE_MIN_DAYS)}
          required
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{t("durationHint")}</p>
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{tErrors(state.message)}</AlertTitle>
        </Alert>
      ) : state.status === "ok" ? (
        <Alert>
          <AlertTitle>{t("submittedTitle")}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || disabled}>
        {t("submit")}
      </Button>
    </form>
  )
}
