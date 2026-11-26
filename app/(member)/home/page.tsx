import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { PendingRequestCard } from "@/components/member/pending-request-card"
import { requireUser } from "@/lib/auth/get-user"
import { getActivePlan } from "@/lib/plans/active"
import { getPendingRequest } from "@/lib/plans/pending"
import { toQuotePlan } from "@/lib/plans/quote"
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

  // Independent reads, one round trip: active plan and the pending plan
  // request, if any (renewal banner + "request in progress" card), plus the next 3
  // upcoming bookings (status = booked AND session start in the future).
  // `!inner` makes the foreign-table filter actually exclude rows whose
  // joined session is in the past — without it, PostgREST keeps the booking
  // row and just nulls out the session.
  const [plan, pendingRequest, { data: bookings }] =
    await Promise.all([
      getActivePlan(supabase, profile.id),
      getPendingRequest(supabase, profile.id),
      supabase
        .from("bookings")
        .select(
          "*, sessions!inner(id, start_at, end_at, trainer, classes(name_ro))",
        )
        .eq("user_id", profile.id)
        .eq("status", "booked")
        .gte("sessions.start_at", new Date().toISOString())
        .order("start_at", { referencedTable: "sessions", ascending: true })
        .limit(3),
    ])

  const firstName = profile.full_name?.split(" ")[0] ?? ""

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("greeting")}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <RenewalBanner plan={plan} hasPendingRequest={!!pendingRequest} />

      {pendingRequest ? (
        <PendingRequestCard
          request={pendingRequest}
          sex={profile.sex}
          activePlan={toQuotePlan(plan)}
        />
      ) : null}

      <PlanCard plan={plan} />

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
