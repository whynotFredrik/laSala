"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

const slotSchema = z.object({
  id: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startHour: z.coerce.number().int().min(0).max(23),
  startMinute: z.union([
    z.literal(0),
    z.literal(15),
    z.literal(30),
    z.literal(45),
  ]),
  durationMin: z.coerce.number().int().min(15).max(240),
  capacity: z.coerce.number().int().min(1).max(50),
  classId: z.string().uuid().nullable().optional(),
  trainer: z.enum(["Eugen", "Marina", "Ana"]),
  isEnabled: z.boolean(),
})

export type ScheduleResult =
  | { status: "ok" }
  | { status: "error"; message: string }

export async function upsertScheduleSlotAction(input: {
  id?: string
  dayOfWeek: number
  startHour: number
  startMinute: number
  durationMin: number
  capacity: number
  classId?: string | null
  trainer: "Eugen" | "Marina" | "Ana"
  isEnabled: boolean
}): Promise<ScheduleResult> {
  const parsed = slotSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  await requireAdmin()
  const service = createServiceClient()

  const row = {
    day_of_week: parsed.data.dayOfWeek,
    start_hour: parsed.data.startHour,
    start_minute: parsed.data.startMinute,
    duration_min: parsed.data.durationMin,
    capacity: parsed.data.capacity,
    class_id: parsed.data.classId ?? null,
    trainer: parsed.data.trainer,
    is_enabled: parsed.data.isEnabled,
  }

  const { error } = parsed.data.id
    ? await service
        .from("schedule_template")
        .update(row)
        .eq("id", parsed.data.id)
    : await service.from("schedule_template").insert(row)

  if (error) {
    return { status: "error", message: "save_failed" }
  }
  revalidatePath("/admin/schedule")
  return { status: "ok" }
}

export async function deleteScheduleSlotAction(id: string) {
  await requireAdmin()
  const service = createServiceClient()
  await service.from("schedule_template").delete().eq("id", id)
  revalidatePath("/admin/schedule")
}
