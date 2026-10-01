import { NextResponse, type NextRequest } from "next/server"
import { addDays, format, formatISO, parseISO } from "date-fns"
import { ro } from "date-fns/locale"

import {
  agendaFor,
  toAgendaSessions,
  type AgendaSessionRow,
} from "@/lib/agenda/daily-agenda"
import { studioDateISO } from "@/lib/booking/rules"
import { sendEmail } from "@/lib/email/send"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Evening cron (17:00 UTC = 20:00/19:00 Bucharest). Emails tomorrow's
 * schedule — every session with its trainer and booked members — to each
 * address in `daily_agenda_recipients` (managed on the admin dashboard).
 * A recipient tied to a trainer only gets that trainer's sessions.
 *
 * Tomorrow's sessions always exist by now: the daily sync generates the
 * current week every morning and next week from Saturday, so Sunday
 * evening already sees Monday.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (Vercel sends it).
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const service = createServiceClient()

  const { data: recipients, error: rErr } = await service
    .from("daily_agenda_recipients")
    .select("email, trainer")
  if (rErr) {
    return NextResponse.json(
      { ok: false, message: rErr.message },
      { status: 500 },
    )
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, recipients: 0 })
  }

  const tomorrow = addDays(parseISO(studioDateISO()), 1)
  const tomorrowIso = formatISO(tomorrow, { representation: "date" })

  const { data: rows, error: sErr } = await service
    .from("sessions")
    .select(
      "start_at, end_at, capacity, trainer, classes(name_ro), bookings(status, profiles(full_name, email))",
    )
    .eq("session_date", tomorrowIso)
  if (sErr) {
    return NextResponse.json(
      { ok: false, message: sErr.message },
      { status: 500 },
    )
  }

  const sessions = toAgendaSessions((rows ?? []) as AgendaSessionRow[])
  const date = format(tomorrow, "EEEE, d MMMM yyyy", { locale: ro })

  let sent = 0
  const failed: string[] = []
  for (const r of recipients) {
    const result = await sendEmail({
      to: r.email,
      template: "dailyAgenda",
      props: { date, trainer: r.trainer, sessions: agendaFor(sessions, r.trainer) },
    })
    if (result.ok) sent++
    else failed.push(r.email)
  }

  return NextResponse.json({
    ok: true,
    date: tomorrowIso,
    sessions: sessions.length,
    sent,
    failed,
  })
}
