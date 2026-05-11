import { NextResponse, type NextRequest } from "next/server"
import { addDays } from "date-fns"
import { toZonedTime } from "date-fns-tz"

import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import { sendEmail } from "@/lib/email/send"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REMINDER_OFFSETS = [3, 1] as const

/**
 * Daily cron — sends a "your last session from the current plan" reminder.
 *
 * Trigger:
 * 1. Plan is active and has zero remaining sessions
 *    (`sessions_used >= sessions_total`).
 * 2. User has at least one upcoming booking.
 * 3. The chronologically LATEST upcoming booking — i.e. the one that
 *    finishes the plan — is exactly 3 or 1 calendar days from today
 *    (in Europe/Bucharest, so day boundaries match the studio's local
 *    sense of "tomorrow").
 *
 * We compare on calendar dates, not 24h windows, to avoid drift across
 * DST transitions and to keep the "today + 3" arithmetic intuitive for
 * the studio owner.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()
  const nowLocal = toZonedTime(new Date(), STUDIO_TZ)

  // Build the set of target calendar dates (in studio TZ) we want to match.
  const targetDates = new Map<string, 1 | 3>()
  for (const days of REMINDER_OFFSETS) {
    const iso = formatStudio(addDays(nowLocal, days), "yyyy-MM-dd")
    targetDates.set(iso, days)
  }

  const { data: plans } = await service
    .from("plans")
    .select(
      "user_id, sessions_total, sessions_used, profiles!user_id(id, email, full_name)",
    )
    .eq("is_active", true)

  let sent = 0

  for (const plan of plans ?? []) {
    if (plan.sessions_used < plan.sessions_total) continue // still has slots
    if (!plan.profiles) continue

    // Latest upcoming booking for this user.
    const { data: latest } = await service
      .from("bookings")
      .select("id, sessions!inner(start_at, classes(name_ro))")
      .eq("user_id", plan.user_id)
      .eq("status", "booked")
      .gte("sessions.start_at", new Date().toISOString())
      .order("start_at", {
        referencedTable: "sessions",
        ascending: false,
      })
      .limit(1)
      .maybeSingle()

    if (!latest?.sessions) continue

    const sessionDate = formatStudio(latest.sessions.start_at, "yyyy-MM-dd")
    const days = targetDates.get(sessionDate)
    if (!days) continue

    await sendEmail({
      to: plan.profiles.email,
      userId: plan.profiles.id,
      template: "bookingReminder",
      props: {
        name: plan.profiles.full_name ?? plan.profiles.email,
        className: latest.sessions.classes?.name_ro ?? "Sesiune",
        date: formatStudio(latest.sessions.start_at, "EEEE d MMMM yyyy"),
        time: formatStudio(latest.sessions.start_at, "HH:mm"),
        days,
      },
    })
    sent++
  }

  return NextResponse.json({ ok: true, sent })
}
