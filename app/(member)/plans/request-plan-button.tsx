"use client"

import { useEffect, useState, useTransition } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlanQuoteSummary } from "@/components/member/plan-quote-summary"
import type { PlanQuote } from "@/lib/plans/quote"

import { requestPlanAction } from "./actions"

type PaymentMethod = "pos" | "cash"

/**
 * "Request plan" button. A member may request a plan while another one is
 * active (an on-time renewal merges into the current plan on approval);
 * only a pending request blocks a new one. The dialog shows what the
 * member will pay (streak discount included) and what the plan will hold
 * before they submit. `highlight` (from `/plans?tier=<id>`, used by
 * renewal reminders) scrolls the tier's card into view — it does not open
 * the dialog, so the member sees the other plans first.
 */
export function RequestPlanButton({
  tierId,
  tierName,
  tierSummary,
  quote,
  hasPending,
  isRenewal,
  highlight = false,
}: {
  tierId: string
  tierName: string
  tierSummary: string
  quote: PlanQuote
  hasPending: boolean
  isRenewal: boolean
  highlight?: boolean
}) {
  const t = useTranslations("plans")
  const tErrors = useTranslations("plansErrors")
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [notes, setNotes] = useState("")
  const [pending, start] = useTransition()

  const disabled = hasPending

  useEffect(() => {
    if (!highlight) return
    document
      .getElementById(`tier-${tierId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [highlight, tierId])

  const submit = () => {
    start(async () => {
      const result = await requestPlanAction({
        tierId,
        paymentMethod: paymentMethod === "" ? undefined : paymentMethod,
        notes: notes.trim() || undefined,
      })
      if (result.status === "error") {
        toast.error(tErrors(result.message))
      } else {
        toast.success(t("requestSubmittedTitle"))
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {hasPending
          ? t("alreadyPending")
          : isRenewal
            ? t("renew")
            : t("request")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isRenewal
                ? t("renewDialogTitle", { plan: tierName })
                : t("requestDialogTitle", { plan: tierName })}
            </DialogTitle>
            <DialogDescription>{tierSummary}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <PlanQuoteSummary quote={quote} />

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">
                {t("preferredPaymentMethod")}
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="paymentMethod">
                  <SelectValue placeholder={t("selectPaymentMethod")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pos">{t("posAtStudio")}</SelectItem>
                  <SelectItem value="cash">{t("cashAtStudio")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t("chooseOtherPlan")}
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {t("submitRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
