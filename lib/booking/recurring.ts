import "server-only"

import { addDays } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

import { STUDIO_TZ, studioWeekStart } from "@/lib/booking/rules"
import type { createServiceClient } from "@/lib/supabase/service"

type ServiceClient = ReturnType<typeof createServiceClient>

/**
 * Whether an automatic (recurring) booking may draw on the member's two
 * grace bookings once the plan is exhausted/expired and no plan is
 * queued. Mirrors what the member could do by hand on the book page.
 * Domain decision — flip to `false` if the studio wants grace to be
 * member-initiated only.
 */
export const RECURRING_ALLOW_GRACE = true

/**
 * Why a recurring auto-booking was skipped. Mirrors the exceptions raised
 * by the `book_session_for` Postgres function so UI and notifications can
 * show a translated reason instead of a bare error.
 */
export type RecurringSkipReason =
  | "alreadyBooked"
  | "sessionFull"
  | "noActivePlan"
  | "planExpired"
  | "noSessionsLeft"
  | "graceExhausted"
  | "notAllowed"
  | "unknown"

export function skipReasonFor(message: string): RecurringSkipReason {
  const m = message.toLowerCase()
  if (m.includes("already booked")) return "alreadyBooked"
  if (m.includes("session is full")) return "sessionFull"
  if (m.includes("no active plan")) return "noActivePlan"
  if (m.includes("grace bookings exhausted")) return "graceExhausted"
  if (m.includes("plan expires")) return "planExpired"
  if (m.includes("no sessions remaining")) return "noSessionsLeft"
  if (m.includes("admin only") || m.includes("permission denied")) {
    return "notAllowed"
  }
  return "unknown"
}

export type PinOutcome = {
  userId: string
  sessionId: string
  templateId: string
  /** Session start, ISO instant. */
  startAt: string
  trainer: string | null
  /**
   * booked   — a new booking was created from the plan
   * grace    — a new booking was created on the grace budget
   * existing — the member already had a booking on that session
   * skipped  — the Postgres function refused (see `reason`)
   */
  status: "booked" | "grace" | "existing" | "skipped"
  reason?: RecurringSkipReason
  /** Raw Postgres message, for logs. */
  message?: string
}

type Candidate = {
  userId: string
  sessionId: string
  templateId: string
  startAt: string
  trainer: string | null
}

/**
 * Upper bound of the booking horizon: end of next studio week. Sessions
 * beyond that never exist yet (see `ensureSessionsForWeek`), but the bound
 * keeps the query cheap and the semantics explicit.
 */
function horizonEnd(now: Date): Date {
  return fromZonedTime(addDays(studioWeekStart(now), 14), STUDIO_TZ)
}

async function loadCandidates(
  service: ServiceClient,
  filter: { userId?: string; templateId?: string; sessionIds?: string[] },
  now: Date,
): Promise<Candidate[]> {
  let pinQuery = service
    .from("recurring_bookings")
    .select("user_id, schedule_template_id")
    .eq("is_active", true)
  if (filter.userId) pinQuery = pinQuery.eq("user_id", filter.userId)
  if (filter.templateId) {
    pinQuery = pinQuery.eq("schedule_template_id", filter.templateId)
  }
  const { data: pins, error: pinErr } = await pinQuery
  if (pinErr) throw new Error(`recurring_load_failed: ${pinErr.message}`)
  if (!pins || pins.length === 0) return []

  const templateIds = Array.from(
    new Set(pins.map((p) => p.schedule_template_id)),
  )

  let sessionQuery = service
    .from("sessions")
    .select("id, schedule_template_id, start_at, trainer")
    .in("schedule_template_id", templateIds)
    .gt("start_at", now.toISOString())
    .lt("start_at", horizonEnd(now).toISOString())
    .order("start_at", { ascending: true })
  if (filter.sessionIds) {
    if (filter.sessionIds.length === 0) return []
    sessionQuery = sessionQuery.in("id", filter.sessionIds)
  }
  const { data: sessions, error: sesErr } = await sessionQuery
  if (sesErr) throw new Error(`sessions_load_failed: ${sesErr.message}`)

  const pinsByTemplate = new Map<string, string[]>()
  for (const p of pins) {
    const list = pinsByTemplate.get(p.schedule_template_id) ?? []
    list.push(p.user_id)
    pinsByTemplate.set(p.schedule_template_id, list)
  }

  const out: Candidate[] = []
  for (const s of sessions ?? []) {
    if (!s.schedule_template_id) continue
    for (const userId of pinsByTemplate.get(s.schedule_template_id) ?? []) {
      out.push({
        userId,
        sessionId: s.id,
        templateId: s.schedule_template_id,
        startAt: s.start_at,
        trainer: s.trainer,
      })
    }
  }
  return out
}

/**
 * Book every (pin, session) pair in `candidates` through the
 * `book_session_for` Postgres function. Pairs whose member already holds a
 * booking on that session are reported as `existing` without an RPC call.
 * Order is by session start so a scarce plan budget is spent on the
 * earliest sessions first (deterministic across runs).
 */
async function bookCandidates(
  service: ServiceClient,
  candidates: Candidate[],
): Promise<PinOutcome[]> {
  if (candidates.length === 0) return []

  const userIds = Array.from(new Set(candidates.map((c) => c.userId)))
  const sessionIds = Array.from(new Set(candidates.map((c) => c.sessionId)))
  const { data: existingRows } = await service
    .from("bookings")
    .select("user_id, session_id")
    .in("user_id", userIds)
    .in("session_id", sessionIds)
    .eq("status", "booked")
  const existing = new Set(
    (existingRows ?? []).map((b) => `${b.user_id}:${b.session_id}`),
  )

  const sorted = [...candidates].sort((a, b) =>
    a.startAt === b.startAt
      ? a.userId.localeCompare(b.userId)
      : a.startAt.localeCompare(b.startAt),
  )

  const outcomes: PinOutcome[] = []
  for (const c of sorted) {
    if (existing.has(`${c.userId}:${c.sessionId}`)) {
      outcomes.push({ ...c, status: "existing" })
      continue
    }
    const { data: booking, error } = await service.rpc("book_session_for", {
      p_user_id: c.userId,
      p_session_id: c.sessionId,
      p_allow_grace: RECURRING_ALLOW_GRACE,
    })
    if (error) {
      outcomes.push({
        ...c,
        status: "skipped",
        reason: skipReasonFor(error.message),
        message: error.message,
      })
      continue
    }
    outcomes.push({ ...c, status: booking?.is_grace ? "grace" : "booked" })
  }
  return outcomes
}

/**
 * Materialise every active recurring pin against the given sessions.
 * Used by the daily sync after it has made sure the week's sessions exist.
 */
export async function bookPinsForSessions(
  service: ServiceClient,
  sessionIds: string[],
  now: Date = new Date(),
): Promise<PinOutcome[]> {
  const candidates = await loadCandidates(service, { sessionIds }, now)
  return bookCandidates(service, candidates)
}

/**
 * Materialise one member's active pins against every future session in
 * the horizon (current + next studio week). Used right after a pin is
 * added (`templateId` narrows to that pin) and after a plan is
 * approved/activated (all pins — retries what was skipped for lack of a
 * plan).
 */
export async function bookPinsForUser(
  service: ServiceClient,
  userId: string,
  opts: { templateId?: string; now?: Date } = {},
): Promise<PinOutcome[]> {
  const now = opts.now ?? new Date()
  const candidates = await loadCandidates(
    service,
    { userId, templateId: opts.templateId },
    now,
  )
  return bookCandidates(service, candidates)
}

/** Session ids touched by a batch of outcomes (for calendar sync). */
export function touchedSessionIds(outcomes: PinOutcome[]): string[] {
  return Array.from(
    new Set(
      outcomes
        .filter((o) => o.status === "booked" || o.status === "grace")
        .map((o) => o.sessionId),
    ),
  )
}
