/**
 * What a plan request will cost and give the member if it is approved now.
 * Mirrors `approve_plan_request` (supabase/migrations/0028_streak_monthly_only.sql):
 * the price for the member's sex minus the streak discount (monthly tiers
 * only) and, for an on-time renewal, the carried-over sessions and the
 * extended end date. The authoritative numbers are decided at approval;
 * this is the quote the member sees before paying.
 */

import { addMonths } from "date-fns"

import {
  isRenewalOnTime,
  isStreakTier,
  nextStreakMonth,
  streakDiscountRon,
  type StreakPlanRef,
} from "@/lib/plans/streak"

export type QuoteTier = {
  category: string
  sessions_per_month: number
  duration_months: number
  price_male_ron: number | string
  price_female_ron: number | string
}

export type QuoteActivePlan = StreakPlanRef & {
  sessions_total: number
  sessions_used: number
}

export type PlanQuote = {
  basePrice: number
  discount: number
  /** What the member pays at the studio. */
  price: number
  /** Streak month the new plan would get (1 for promotions). */
  streakMonth: number
  /** Sessions the tier itself grants. */
  tierSessions: number
  /**
   * Set when approval today would merge into the current plan: unused
   * sessions carried over, the new total and the new end date
   * ("YYYY-MM-DD"), and the last day to pay for the merge (and discount).
   */
  merge: {
    carriedOver: number
    totalSessions: number
    endDate: string
    payBy: string
  } | null
}

/** Build a `QuoteActivePlan` from a plan row joined with its tier. */
export function toQuotePlan(
  plan:
    | {
        streak_month: number
        end_date: string
        sessions_total: number
        sessions_used: number
        plan_tiers: { category: string } | null
      }
    | null,
): QuoteActivePlan | null {
  if (!plan) return null
  return {
    streak_month: plan.streak_month,
    end_date: plan.end_date,
    tier_category: plan.plan_tiers?.category ?? null,
    sessions_total: plan.sessions_total,
    sessions_used: plan.sessions_used,
  }
}

/** Price column for the member's sex; legacy accounts without sex pay the male price. */
export function basePriceFor(
  tier: Pick<QuoteTier, "price_male_ron" | "price_female_ron">,
  sex: string | null | undefined,
): number {
  return Number(sex === "female" ? tier.price_female_ron : tier.price_male_ron)
}

/** `date + months` on a "YYYY-MM-DD" date, clamped to month end like Postgres. */
export function addMonthsToDate(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const next = addMonths(new Date(y, m - 1, d), months)
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, "0"),
    String(next.getDate()).padStart(2, "0"),
  ].join("-")
}

export function quotePlan(
  tier: QuoteTier,
  sex: string | null | undefined,
  activePlan: QuoteActivePlan | null,
  now: Date = new Date(),
): PlanQuote {
  const basePrice = basePriceFor(tier, sex)
  const streakMonth = nextStreakMonth(activePlan, tier.category, now)
  const discount = isStreakTier(tier.category)
    ? streakDiscountRon(streakMonth)
    : 0
  const tierSessions = tier.sessions_per_month * tier.duration_months

  const onTime = !!activePlan && isRenewalOnTime(activePlan.end_date, now)
  const carriedOver = activePlan
    ? Math.max(activePlan.sessions_total - activePlan.sessions_used, 0)
    : 0

  return {
    basePrice,
    discount,
    price: Math.max(basePrice - discount, 0),
    streakMonth,
    tierSessions,
    merge:
      onTime && activePlan
        ? {
            carriedOver,
            totalSessions: tierSessions + carriedOver,
            endDate: addMonthsToDate(
              activePlan.end_date,
              tier.duration_months,
            ),
            payBy: activePlan.end_date,
          }
        : null,
  }
}
