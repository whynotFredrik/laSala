/**
 * Pure helpers for the consistency streak ("Streak de consecvență").
 * Mirrors the rules encoded in supabase/migrations/0025_renewal_streak.sql
 * (discount table) and 0028_streak_monthly_only.sql (approve_plan_request)
 * — keep the two in sync.
 *
 * The rule: payment (admin approval) of the next plan no later than the
 * current plan's end_date — as a Bucharest calendar date — continues the
 * streak, and only from a monthly plan to a monthly plan. Promotions (the
 * 6-month packages) never hold a streak: they get no discount, and the
 * first monthly plan after one starts at month 1.
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
 * Mirrors `public.streak_discount_ron` (0025).
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

/** Only month-to-month tiers take part in the streak. */
export function isStreakTier(category: string | null | undefined): boolean {
  return category === "monthly"
}

/** What `nextStreakMonth` needs to know about the member's current plan. */
export type StreakPlanRef = {
  streak_month: number
  end_date: string
  tier_category: string | null
}

/** Build a `StreakPlanRef` from a plan row joined with its tier. */
export function toStreakRef(
  plan:
    | {
        streak_month: number
        end_date: string
        plan_tiers: { category: string } | null
      }
    | null,
): StreakPlanRef | null {
  if (!plan) return null
  return {
    streak_month: plan.streak_month,
    end_date: plan.end_date,
    tier_category: plan.plan_tiers?.category ?? null,
  }
}

/**
 * The streak month a renewal approved right now would get, given the
 * member's current active plan (or null when they have none) and the
 * category of the tier being bought. Anything but monthly → monthly, on
 * time, is month 1.
 */
export function nextStreakMonth(
  activePlan: StreakPlanRef | null,
  newTierCategory: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!isStreakTier(newTierCategory)) return 1
  if (
    activePlan &&
    isStreakTier(activePlan.tier_category) &&
    isRenewalOnTime(activePlan.end_date, now)
  ) {
    return activePlan.streak_month + 1
  }
  return 1
}
