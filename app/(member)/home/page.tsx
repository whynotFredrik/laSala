import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth/get-user"
import { getMemberPlans } from "@/lib/plans/active"
import { createClient } from "@/lib/supabase/server"

import { PlanCard } from "./plan-card"
import { RenewalBanner } from "./renewal-banner"
import {
  UpcomingBookings,
  type UpcomingBooking,
} from "./upcoming-bookings"

export default async function HomePage() {
  const { profile } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("home")

  // Active plan (+ the queued one waiting behind it, if any) and whether a
  // renewal request is already pending — drives the renewal banner.
  const [{ active: plan, queued }, { data: pendingRequest }] =
    await Promise.all([
      getMemberPlans(supabase, profile.id),
      supabase
        .from("plan_requests")
        .select("id")
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle(),
    ])

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

      <RenewalBanner
        plan={plan}
        queued={queued}
        hasPendingRequest={!!pendingRequest}
      />

      <PlanCard plan={plan} queued={queued} />

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
