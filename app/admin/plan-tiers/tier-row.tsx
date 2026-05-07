"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { upsertTierAction } from "./actions"

export type Tier = {
  id?: string
  code: string
  name_ro: string
  name_en: string | null
  category: "monthly" | "promo_6m"
  sessions_per_month: number
  duration_months: number
  price_male_ron: number
  price_female_ron: number
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
        priceMaleRon: draft.price_male_ron,
        priceFemaleRon: draft.price_female_ron,
        displayOrder: draft.display_order,
        isActive: draft.is_active,
      })
      if (res.status === "error") toast.error(t(res.message as "save_failed"))
      else toast.success(t("saved"))
    })

  return (
    <li className="space-y-3 rounded border p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
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
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label htmlFor={`m-${draft.id}`} className="text-xs">
            {t("priceMale")}
          </Label>
          <Input
            id={`m-${draft.id}`}
            type="number"
            value={draft.price_male_ron}
            onChange={(e) =>
              setDraft({ ...draft, price_male_ron: Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`f-${draft.id}`} className="text-xs">
            {t("priceFemale")}
          </Label>
          <Input
            id={`f-${draft.id}`}
            type="number"
            value={draft.price_female_ron}
            onChange={(e) =>
              setDraft({ ...draft, price_female_ron: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={save} disabled={pending} size="sm">
            {t("save")}
          </Button>
        </div>
      </div>
    </li>
  )
}
