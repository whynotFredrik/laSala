"use client"

import { useState, useTransition } from "react"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

import {
  approvePlanRequestAction,
  rejectPlanRequestAction,
} from "./actions"

type PaymentMethod = "pos" | "cash"

export function RequestRow({
  request,
}: {
  request: {
    id: string
    created_at: string
    profile: { full_name: string | null; email: string }
    tier: { name_ro: string; price_ron: number } | null
    notes: string | null
    preferred_payment_method: string | null
  }
}) {
  const t = useTranslations("adminPlanRequests")
  const [pending, start] = useTransition()
  // Default to the requester's preferred method when it's still a valid
  // option. Bank-transfer requests from before we removed that channel get
  // bumped to "pos" so the admin can still approve them.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    request.preferred_payment_method === "pos" ||
      request.preferred_payment_method === "cash"
      ? (request.preferred_payment_method as PaymentMethod)
      : "pos",
  )
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  )

  const approve = () =>
    start(async () => {
      const res = await approvePlanRequestAction({
        requestId: request.id,
        paymentMethod,
        startDate,
      })
      if (res.status === "error") toast.error(t(res.message as "approve_failed"))
      else toast.success(t("approved"))
    })

  const reject = () =>
    start(async () => {
      const reason = prompt(t("rejectReasonPrompt") ?? "") ?? undefined
      const res = await rejectPlanRequestAction({
        requestId: request.id,
        reason,
      })
      if (res.status === "error") toast.error(t(res.message as "reject_failed"))
      else toast.success(t("rejected"))
    })

  return (
    <li className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">
            {request.profile.full_name ?? request.profile.email}
          </p>
          <p className="text-xs text-muted-foreground">
            {request.profile.email}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), "d MMM yyyy, HH:mm", {
            locale: ro,
          })}
        </p>
      </div>
      <div className="text-sm">
        <span className="font-medium">
          {request.tier?.name_ro ?? t("unknownTier")}
        </span>
        {request.tier ? (
          <>
            {" · "}
            <span className="text-muted-foreground">
              {request.tier.price_ron} RON
            </span>
          </>
        ) : null}
      </div>
      {request.notes ? (
        <p className="text-sm text-muted-foreground">{request.notes}</p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Select
          value={paymentMethod}
          onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pos">{t("pos")}</SelectItem>
            <SelectItem value="cash">{t("cash")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Button type="button" onClick={approve} disabled={pending}>
          {t("approve")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={reject}
          disabled={pending}
        >
          {t("reject")}
        </Button>
      </div>
    </li>
  )
}
