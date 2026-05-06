"use client"

import { useState, useTransition } from "react"
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

import { requestPlanAction } from "./actions"

type PaymentMethod = "bank_transfer" | "pos" | "cash"

export function RequestPlanButton({
  tierId,
  hasPending,
  hasActive,
}: {
  tierId: string
  hasPending: boolean
  hasActive: boolean
}) {
  const t = useTranslations("plans")
  const tErrors = useTranslations("plansErrors")
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [notes, setNotes] = useState("")
  const [pending, start] = useTransition()

  const disabled = hasPending || hasActive

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
        {hasActive
          ? t("alreadyActive")
          : hasPending
            ? t("alreadyPending")
            : t("request")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("requestDialogTitle")}</DialogTitle>
            <DialogDescription>{t("requestDialogBody")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                  <SelectItem value="bank_transfer">
                    {t("bankTransfer")}
                  </SelectItem>
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
              {t("cancel")}
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
