import "server-only"

import { addDays, formatISO } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { createTranslator } from "next-intl"

import type { PinOutcome, RecurringSkipReason } from "@/lib/booking/recurring"
import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import { notificationCopy, notify } from "@/lib/notifications/notify"
import {
  buildWeeklySummary,
  formatSummaryLines,
  weeklySummaryDedupeKey,
  type DayKey,
} from "@/lib/notifications/weekly-summary"
import type { createServiceClient } from "@/lib/supabase/service"
import messages from "@/messages/ro.json"

type ServiceClient = ReturnType<typeof createServiceClient>

function translators() {
  const copy = notificationCopy()
  const days = createTranslator({ locale: "ro", messages, namespace: "days" })
  return {
    copy,
    lines: {
      dayName: (key: DayKey) => days(key),
      reasonText: (reason: RecurringSkipReason) =>
        copy(`skipReasons.${reason}` as "skipReasons.unknown"),
      graceSuffix: copy("graceSuffix"),
    },
  }
}

/**
 * "Your sessions in week X" — one notification + email per member with at
 * least one active recurring pin, for the studio week starting at
 * `weekStartLocal` (a zoned Monday from `studioWeekStart`). Deduped per
 * week through the notification key, so re-running the daily sync (or a
 * missed Saturday covered by the Sunday run) never sends it twice.
 */
export async function sendWeeklySummaries(
  service: ServiceClient,
  weekStartLocal: Date,
  outcomes: PinOutcome[],
): Promise<{ sent: number; duplicate: number }> {
  const weekStartISO = formatISO(weekStartLocal, { representation: "date" })
  const weekEndLocal = addDays(weekStartLocal, 7)
  const fromUtc = fromZonedTime(weekStartLocal, STUDIO_TZ).toISOString()
  const toUtc = fromZonedTime(weekEndLocal, STUDIO_TZ).toISOString()

  const { data: pins } = await service
    .from("recurring_bookings")
    .select("user_id, profiles!recurring_bookings_user_id_fkey(email, full_name)")
    .eq("is_active", true)
  const members = new Map<string, { email: string; name: string }>()
  for (const p of pins ?? []) {
    if (!p.profiles) continue
    members.set(p.user_id, {
      email: p.profiles.email,
      name: p.profiles.full_name ?? p.profiles.email,
    })
  }
  if (members.size === 0) return { sent: 0, duplicate: 0 }

  const { data: bookings } = await service
    .from("bookings")
    .select("user_id, session_id, is_grace, sessions!inner(start_at, trainer)")
    .in("user_id", Array.from(members.keys()))
    .eq("status", "booked")
    .gte("sessions.start_at", fromUtc)
    .lt("sessions.start_at", toUtc)

  const bookedByUser = new Map<
    string,
    { sessionId: string; startAt: string; trainer: string | null; grace: boolean }[]
  >()
  for (const b of bookings ?? []) {
    if (!b.sessions) continue
    const list = bookedByUser.get(b.user_id) ?? []
    list.push({
      sessionId: b.session_id,
      startAt: b.sessions.start_at,
      trainer: b.sessions.trainer,
      grace: b.is_grace,
    })
    bookedByUser.set(b.user_id, list)
  }

  const outcomesByUser = new Map<string, PinOutcome[]>()
  for (const o of outcomes) {
    if (o.startAt < fromUtc || o.startAt >= toUtc) continue
    const list = outcomesByUser.get(o.userId) ?? []
    list.push(o)
    outcomesByUser.set(o.userId, list)
  }

  const { copy, lines } = translators()
  const weekLabel = `${formatStudio(fromZonedTime(weekStartLocal, STUDIO_TZ), "d MMM")} – ${formatStudio(
    fromZonedTime(addDays(weekStartLocal, 6), STUDIO_TZ),
    "d MMM",
  )}`

  let sent = 0
  let duplicate = 0
  for (const [userId, member] of members) {
    const summary = buildWeeklySummary({
      booked: bookedByUser.get(userId) ?? [],
      outcomes: outcomesByUser.get(userId) ?? [],
    })
    if (summary.booked.length === 0 && summary.skipped.length === 0) continue

    const rendered = formatSummaryLines(summary, lines)
    const bodyParts: string[] = []
    if (rendered.booked.length > 0) {
      bodyParts.push(copy("weeklySummaryIntro"))
      bodyParts.push(...rendered.booked.map((l) => `• ${l}`))
    } else {
      bodyParts.push(copy("weeklySummaryNone"))
    }
    if (rendered.skipped.length > 0) {
      bodyParts.push(copy("weeklySummarySkippedIntro"))
      bodyParts.push(...rendered.skipped.map((l) => `• ${l}`))
    }

    const result = await notify({
      userId,
      type: "weekly_summary",
      title: copy("weeklySummaryTitle", { weekLabel }),
      body: bodyParts.join("\n"),
      data: {
        week_start: weekStartISO,
        booked: rendered.booked,
        skipped: rendered.skipped,
      },
      dedupeKey: weeklySummaryDedupeKey(weekStartISO),
      email: {
        to: member.email,
        template: "weeklySummary",
        props: {
          name: member.name,
          weekLabel,
          booked: rendered.booked,
          skipped: rendered.skipped,
          kind: "weekly",
        },
      },
    })
    if (result.status === "sent") sent++
    else if (result.status === "duplicate") duplicate++
  }
  return { sent, duplicate }
}

/**
 * One-off note when an admin adds a pin and it produced bookings right
 * away (same template, `kind: "pinAdded"`, no dedupe).
 */
export async function sendPinAddedNotice(
  service: ServiceClient,
  userId: string,
  outcomes: PinOutcome[],
): Promise<void> {
  const summary = buildWeeklySummary({ booked: [], outcomes })
  if (summary.booked.length === 0) return

  const { data: profile } = await service
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle()
  if (!profile) return

  const { copy, lines } = translators()
  const rendered = formatSummaryLines(summary, lines)
  await notify({
    userId,
    type: "pins_booked",
    title: copy("pinsBookedTitle"),
    body: [copy("pinsBookedIntro"), ...rendered.booked.map((l) => `• ${l}`)].join(
      "\n",
    ),
    data: { booked: rendered.booked },
    email: {
      to: profile.email,
      template: "weeklySummary",
      props: {
        name: profile.full_name ?? profile.email,
        weekLabel: "",
        booked: rendered.booked,
        skipped: [],
        kind: "pinAdded",
      },
    },
  })
}
