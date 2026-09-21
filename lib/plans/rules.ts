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
