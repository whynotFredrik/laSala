import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { PlanCard, type ActivePlan } from "./plan-card"
import {
  UpcomingBookings,
  type UpcomingBooking,
} from "./upcoming-bookings"

export default async function HomePage() {
  const { profile } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("home")

  // Active plan + tier name. Returns one row max thanks to the partial unique
  // index in 0001_init.sql; .maybeSingle() handles "no plan yet".
  const { data: plan } = await supabase
    .from("plans")
    .select("*, plan_tiers(name_ro, name_en)")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .maybeSingle()

  // Next 3 upcoming bookings (status = booked AND session start in the future).
  // `!inner` makes the foreign-table filter actually exclude rows whose
  // joined session is in the past — without it, PostgREST keeps the booking
  // row and just nulls out the session.
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "*, sessions!inner(id, start_at, end_at, classes(name_ro))",
    )
    .eq("user_id", profile.id)
    .eq("status", "booked")
    .gte("sessions.start_at", new Date().toISOString())
    .order("start_at", { referencedTable: "sessions", ascending: true })
    .limit(3)

  const firstName = profile.full_name?.split(" ")[0] ?? ""

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("greeting")}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <PlanCard plan={(plan ?? null) as ActivePlan} />

      <UpcomingBookings
        bookings={(bookings ?? []) as UpcomingBooking[]}
      />

      <div className="flex justify-center">
        <Link href="/book" className={buttonVariants()}>
          {t("bookNow")}
        </Link>
      </div>
    </div>
  )
}
