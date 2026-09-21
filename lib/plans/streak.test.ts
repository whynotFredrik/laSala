import { describe, expect, it } from "vitest"

import {
  isRenewalOnTime,
  isStreakTier,
  nextStreakMonth,
  streakDiscountRon,
  toStreakRef,
} from "./streak"

describe("streakDiscountRon", () => {
  it("gives no discount for the first month", () => {
    expect(streakDiscountRon(1)).toBe(0)
    expect(streakDiscountRon(0)).toBe(0)
  })

  it("gives 15 RON in month 2 and 30 RON in month 3", () => {
    expect(streakDiscountRon(2)).toBe(15)
    expect(streakDiscountRon(3)).toBe(30)
  })

  it("caps at the 40 RON veteran discount from month 4 onward", () => {
    expect(streakDiscountRon(4)).toBe(40)
    expect(streakDiscountRon(5)).toBe(40)
    expect(streakDiscountRon(24)).toBe(40)
  })
})

describe("isRenewalOnTime", () => {
  // 2026-08-10T21:30Z is already 2026-08-11 00:30 in Bucharest (UTC+3).
  const lateEveningUtc = new Date("2026-08-10T21:30:00Z")

  it("is on time up to and including end_date", () => {
    expect(isRenewalOnTime("2026-08-15", new Date("2026-08-10T12:00:00Z"))).toBe(
      true,
    )
    expect(isRenewalOnTime("2026-08-10", new Date("2026-08-10T12:00:00Z"))).toBe(
      true,
    )
  })

  it("is late the day after end_date", () => {
    expect(isRenewalOnTime("2026-08-09", new Date("2026-08-10T12:00:00Z"))).toBe(
      false,
    )
  })

  it("uses the Bucharest calendar date, not UTC", () => {
    // Still Aug 10 in UTC, but Aug 11 at the studio → too late for Aug 10.
    expect(isRenewalOnTime("2026-08-10", lateEveningUtc)).toBe(false)
    expect(isRenewalOnTime("2026-08-11", lateEveningUtc)).toBe(true)
  })
})

describe("nextStreakMonth", () => {
  const now = new Date("2026-08-10T12:00:00Z")
  const monthly = (streak_month: number, end_date: string) => ({
    streak_month,
    end_date,
    tier_category: "monthly",
  })

  it("starts at 1 with no active plan", () => {
    expect(nextStreakMonth(null, "monthly", now)).toBe(1)
  })

  it("increments monthly → monthly when the active plan has not expired", () => {
    expect(nextStreakMonth(monthly(2, "2026-08-20"), "monthly", now)).toBe(3)
  })

  it("resets to 1 when the active plan already expired", () => {
    expect(nextStreakMonth(monthly(3, "2026-08-01"), "monthly", now)).toBe(1)
  })

  it("is 1 whenever a promotion is involved", () => {
    // Buying a promo: no streak, regardless of the current plan.
    expect(nextStreakMonth(monthly(3, "2026-08-20"), "promo_6m", now)).toBe(1)
    // Coming off a promo: the first monthly plan starts the streak.
    expect(
      nextStreakMonth(
        { streak_month: 1, end_date: "2026-08-20", tier_category: "promo_6m" },
        "monthly",
        now,
      ),
    ).toBe(1)
    expect(nextStreakMonth(null, "promo_6m", now)).toBe(1)
  })
})

describe("toStreakRef / isStreakTier", () => {
  it("copies the tier category and treats only monthly as streak", () => {
    expect(
      toStreakRef({
        streak_month: 2,
        end_date: "2026-08-20",
        plan_tiers: { category: "promo_6m" },
      }),
    ).toEqual({ streak_month: 2, end_date: "2026-08-20", tier_category: "promo_6m" })
    expect(toStreakRef(null)).toBeNull()
    expect(isStreakTier("monthly")).toBe(true)
    expect(isStreakTier("promo_6m")).toBe(false)
    expect(isStreakTier(null)).toBe(false)
  })
})
