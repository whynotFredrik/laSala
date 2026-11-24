/**
 * Pure plan helpers shared by pages, server actions and cron routes.
 * The authoritative checks live in supabase/migrations/0027_renewal_merges_sessions.sql
 * (`approve_plan_request`) — keep in sync.
 */

export type PlanLike = {
  end_date: string
  sessions_used: number
  sessions_total: number
}

export function remainingSessions(plan: PlanLike): number {
  return Math.max(plan.sessions_total - plan.sessions_used, 0)
}

/**
 * Whether the plan can still cover a booking on `onDateISO` (YYYY-MM-DD,
 * studio calendar): not past its end date and with sessions left.
 * Mirrors the condition in `resolve_plan_for_booking`.
 */
export function isPlanUsable(plan: PlanLike, onDateISO: string): boolean {
  return plan.end_date >= onDateISO && plan.sessions_used < plan.sessions_total
}

/**
 * How many sessions before the end the "renew now" reminders start.
 * Studio rule: 12-session plans (and bigger) → 3 sessions before,
 * 8-session plans (and smaller) → 2 sessions before.
 */
export function renewalThreshold(sessionsTotal: number): number {
  return sessionsTotal >= 12 ? 3 : 2
}

/**
 * True when the member should be nudged to renew: remaining sessions at or
 * below the tier's threshold. Fires again for every lower value (the
 * caller dedupes on `renewalDedupeKey`).
 */
export function renewalReminderDue(plan: PlanLike): boolean {
  const remaining = plan.sessions_total - plan.sessions_used
  return remaining >= 0 && remaining <= renewalThreshold(plan.sessions_total)
}

export function renewalDedupeKey(planId: string, remaining: number): string {
  return `renewal:${planId}:${remaining}`
}

export function expiryDedupeKey(planId: string, days: number): string {
  return `expiry:${planId}:${days}`
}

export function planActivatedDedupeKey(planId: string): string {
  return `plan_activated:${planId}`
}

/** Admin "Reînnoiri" tab: who to talk to about the next plan. */
export const RENEWAL_WATCH = {
  /** Plans with this many sessions left (or fewer) are listed. */
  MAX_SESSIONS_LEFT: 2,
  /** Plans ending within this many days of today (inclusive) are listed. */
  EXPIRY_DAYS: 7,
} as const

export type RenewalWatch = {
  remaining: number
  /** Days from `todayISO` to `end_date`; negative once it has passed. */
  daysLeft: number
  lowSessions: boolean
  expiringSoon: boolean
}

/**
 * Why an active plan belongs on the admin renewals list, or null when it
 * does not: at most `MAX_SESSIONS_LEFT` sessions left, or `end_date`
 * within `EXPIRY_DAYS` of today (an already-passed date counts).
 * `todayISO` is the studio date, YYYY-MM-DD.
 */
export function renewalWatchFor(
  plan: PlanLike,
  todayISO: string,
): RenewalWatch | null {
  const remaining = remainingSessions(plan)
  const daysLeft = Math.round(
    (Date.parse(`${plan.end_date}T00:00:00Z`) -
      Date.parse(`${todayISO}T00:00:00Z`)) /
      86_400_000,
  )
  const lowSessions = remaining <= RENEWAL_WATCH.MAX_SESSIONS_LEFT
  const expiringSoon = daysLeft <= RENEWAL_WATCH.EXPIRY_DAYS
  if (!lowSessions && !expiringSoon) return null
  return { remaining, daysLeft, lowSessions, expiringSoon }
}
