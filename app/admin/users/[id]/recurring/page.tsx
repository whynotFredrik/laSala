import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { AddRecurring, type SlotOption } from "./add-recurring"
import { RemoveRecurringButton } from "./remove-button"

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const t = await getTranslations("adminRecurring")
  const tDays = await getTranslations("days")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, trainer")
    .eq("id", id)
    .maybeSingle()
  if (!profile) notFound()

  // Member's existing recurring entries (active only) + the slot they point at.
  const { data: existing } = await supabase
    .from("recurring_bookings")
    .select(
      "id, schedule_template(id, day_of_week, start_hour, start_minute, trainer, capacity, is_enabled)",
    )
    .eq("user_id", id)
    .eq("is_active", true)

  type RecurringWithSlot = {
    id: string
    schedule_template:
      | {
          id: string
          day_of_week: number
          start_hour: number
          start_minute: number
          trainer: string | null
          capacity: number
          is_enabled: boolean
        }
      | null
  }
  const existingList = (existing ?? []) as RecurringWithSlot[]
  const pinnedTemplateIds = new Set(
    existingList.map((r) => r.schedule_template?.id).filter(Boolean) as string[],
  )

  // All enabled slots — optionally filtered to the member's trainer so the
  // dropdown doesn't suggest assignments that violate the trainer/sex rule.
  let availableQuery = supabase
    .from("schedule_template")
    .select(
      "id, day_of_week, start_hour, start_minute, trainer, capacity, is_enabled",
    )
    .eq("is_enabled", true)
    .order("day_of_week", { ascending: true })
    .order("start_hour", { ascending: true })
  if (profile.trainer) {
    availableQuery = availableQuery.eq("trainer", profile.trainer)
  }
  const { data: allSlots } = await availableQuery

  const availableSlots: SlotOption[] = (allSlots ?? [])
    .filter((s) => !pinnedTemplateIds.has(s.id))
    .map((s) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_hour: s.start_hour,
      start_minute: s.start_minute,
      trainer: s.trainer,
      capacity: s.capacity,
    }))

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/admin/users/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {profile.full_name ?? profile.email}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Alert>
        <AlertTitle>{t("howItWorksTitle")}</AlertTitle>
        <AlertDescription>{t("howItWorksBody")}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>{t("currentPinned")}</CardTitle>
          <CardDescription>
            {existingList.length === 0
              ? t("nonePinned")
              : t("countPinned", { count: existingList.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {existingList.length === 0 ? null : (
            <ul className="divide-y">
              {existingList.map((r) => {
                const s = r.schedule_template
                if (!s) return null
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium capitalize">
                        {tDays(DAY_KEYS[s.day_of_week]!)}
                      </span>{" "}
                      <span className="font-mono">
                        {s.start_hour.toString().padStart(2, "0")}:
                        {s.start_minute.toString().padStart(2, "0")}
                      </span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                        {s.trainer ?? "—"}
                      </span>
                    </div>
                    <RemoveRecurringButton
                      recurringId={r.id}
                      userId={profile.id}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("addNew")}</CardTitle>
          <CardDescription>
            {profile.trainer
              ? t("filteredByTrainer", { trainer: profile.trainer })
              : t("memberHasNoTrainer")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddRecurring userId={profile.id} slots={availableSlots} />
        </CardContent>
      </Card>

      <Link
        href={`/admin/users/${id}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        ← {t("back")}
      </Link>
    </div>
  )
}
