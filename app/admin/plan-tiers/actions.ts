"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

const tierSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(50),
  nameRo: z.string().min(1).max(120),
  nameEn: z.string().max(120).optional().nullable(),
  category: z.enum(["monthly", "promo_6m"]),
  sessionsPerMonth: z.coerce.number().int().min(1).max(40),
  durationMonths: z.coerce.number().int().min(1).max(24),
  priceRon: z.coerce.number().min(0).max(100000),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean(),
})

export type TierResult = { status: "ok" } | { status: "error"; message: string }

export async function upsertTierAction(input: {
  id?: string
  code: string
  nameRo: string
  nameEn?: string | null
  category: "monthly" | "promo_6m"
  sessionsPerMonth: number
  durationMonths: number
  priceRon: number
  displayOrder: number
  isActive: boolean
}): Promise<TierResult> {
  const parsed = tierSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "invalid_input" }

  await requireAdmin()
  const service = createServiceClient()

  const row = {
    code: parsed.data.code,
    name_ro: parsed.data.nameRo,
    name_en: parsed.data.nameEn ?? null,
    category: parsed.data.category,
    sessions_per_month: parsed.data.sessionsPerMonth,
    duration_months: parsed.data.durationMonths,
    price_ron: parsed.data.priceRon,
    display_order: parsed.data.displayOrder,
    is_active: parsed.data.isActive,
  }
  const { error } = parsed.data.id
    ? await service
        .from("plan_tiers")
        .update(row)
        .eq("id", parsed.data.id)
    : await service.from("plan_tiers").insert(row)
  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "code_taken" }
    }
    return { status: "error", message: "save_failed" }
  }
  revalidatePath("/admin/plan-tiers")
  revalidatePath("/plans")
  return { status: "ok" }
}
