"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { upsertTierAction } from "./actions"

export type Tier = {
  id?: string
  code: string
  name_ro: string
  name_en: string | null
  category: "monthly" | "promo_6m"
  sessions_per_month: number
  duration_months: number
  price_ron: number
  display_order: number
  is_active: boolean
}

export function TierRow({ tier }: { tier: Tier }) {
  const t = useTranslations("adminPlanTiers")
  const [draft, setDraft] = useState(tier)
  const [pending, start] = useTransition()

  const save = () =>
    start(async () => {
      const res = await upsertTierAction({
        id: draft.id,
        code: draft.code,
        nameRo: draft.name_ro,
        nameEn: draft.name_en,
        category: draft.category,
        sessionsPerMonth: draft.sessions_per_month,
        durationMonths: draft.duration_months,
        priceRon: draft.price_ron,
        displayOrder: draft.display_order,
        isActive: draft.is_active,
      })
      if (res.status === "error") toast.error(t(res.message as "save_failed"))
      else toast.success(t("saved"))
    })

  return (
    <li className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_2fr_auto_auto_auto]">
      <Input
        value={draft.code}
        onChange={(e) => setDraft({ ...draft, code: e.target.value })}
        placeholder={t("code")}
      />
      <Input
        value={draft.name_ro}
        onChange={(e) => setDraft({ ...draft, name_ro: e.target.value })}
        placeholder={t("nameRo")}
      />
      <Input
        type="number"
        value={draft.sessions_per_month}
        onChange={(e) =>
          setDraft({ ...draft, sessions_per_month: Number(e.target.value) })
        }
        className="w-20"
      />
      <Input
        type="number"
        value={draft.price_ron}
        onChange={(e) =>
          setDraft({ ...draft, price_ron: Number(e.target.value) })
        }
        className="w-24"
      />
      <Button type="button" onClick={save} disabled={pending} size="sm">
        {t("save")}
      </Button>
    </li>
  )
}
