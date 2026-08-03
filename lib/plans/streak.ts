/**
 * Pure helpers for the consistency streak ("Streak de consecvență").
 * Mirrors the rules encoded in supabase/migrations/0018_renewal_streak.sql —
 * keep the two in sync.
 *
 * The rule: payment (admin approval) of the next plan no later than the
 * current plan's end_date — as a Bucharest calendar date — continues the
 * streak. Monthly tiers get a flat RON discount by streak month; 6-month
 * promo tiers advance the counter but never receive the discount.
 */

import { toZonedTime } from "date-fns-tz"

import { STUDIO_TZ } from "@/lib/booking/rules"

/** streak month → discount in RON (months missing from the map get 0). */
export const STREAK_DISCOUNTS_RON: Record<number, number> = {
  2: 15,
  3: 30,
}
/** From this streak month onward the discount is capped at the veteran rate. */
export const STREAK_VETERAN_MONTH = 4
export const STREAK_VETERAN_DISCOUNT_RON = 40

/**
 * Discount in RON for a plan in the given streak month.
 * Mirrors `public.streak_discount_ron` in 0018.
 */
export function streakDiscountRon(streakMonth: number): number {
  if (streakMonth >= STREAK_VETERAN_MONTH) return STREAK_VETERAN_DISCOUNT_RON
  return STREAK_DISCOUNTS_RON[streakMonth] ?? 0
}

/**
 * True while paying today still continues the streak: the studio-local
 * calendar date is on or before the plan's end_date (a `date` column,
 * "YYYY-MM-DD"). end_date already includes freeze extensions.
 */
export function isRenewalOnTime(
  planEndDate: string,
  now: Date = new Date(),
): boolean {
  const localToday = toZonedTime(now, STUDIO_TZ)
  const today = [
    localToday.getFullYear(),
    String(localToday.getMonth() + 1).padStart(2, "0"),
    String(localToday.getDate()).padStart(2, "0"),
  ].join("-")
  return today <= planEndDate
}

/**
 * The streak month a renewal approved right now would get, given the
 * member's current active plan (or null when they have none).
 */
export function nextStreakMonth(
  activePlan: { streak_month: number; end_date: string } | null,
  now: Date = new Date(),
): number {
  if (activePlan && isRenewalOnTime(activePlan.end_date, now)) {
    return activePlan.streak_month + 1
  }
  return 1
}
