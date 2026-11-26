import { describe, expect, it } from "vitest"

import { addMonthsToDate, quotePlan, type QuoteActivePlan } from "./quote"

const monthly12 = {
  category: "monthly",
  sessions_per_month: 12,
  duration_months: 1,
  price_male_ron: 390,
  price_female_ron: "350",
}
const promo6 = {
  category: "promo",
  sessions_per_month: 12,
  duration_months: 6,
  price_male_ron: 1990,
  price_female_ron: 1790,
}

const active: QuoteActivePlan = {
  streak_month: 2,
  end_date: "2026-11-30",
  tier_category: "monthly",
  sessions_total: 12,
  sessions_used: 9,
}

const beforeEnd = new Date("2026-11-26T10:00:00Z")
const afterEnd = new Date("2026-12-02T10:00:00Z")

describe("addMonthsToDate", () => {
  it("adds months to a calendar date", () => {
    expect(addMonthsToDate("2026-11-30", 1)).toBe("2026-12-30")
    expect(addMonthsToDate("2026-11-30", 6)).toBe("2027-05-30")
  })

  it("clamps to the end of a shorter month, like Postgres", () => {
    expect(addMonthsToDate("2027-01-31", 1)).toBe("2027-02-28")
  })
})

describe("quotePlan", () => {
  it("charges the price for the member's sex", () => {
    expect(quotePlan(monthly12, "female", null, beforeEnd).price).toBe(350)
    expect(quotePlan(monthly12, "male", null, beforeEnd).price).toBe(390)
    expect(quotePlan(monthly12, null, null, beforeEnd).price).toBe(390)
  })

  it("has no discount and no merge for a first plan", () => {
    const q = quotePlan(monthly12, "male", null, beforeEnd)
    expect(q).toMatchObject({ discount: 0, streakMonth: 1, merge: null })
  })

  it("applies the next streak month's discount on an on-time monthly renewal", () => {
    const q = quotePlan(monthly12, "male", active, beforeEnd)
    expect(q).toMatchObject({
      basePrice: 390,
      streakMonth: 3,
      discount: 30,
      price: 360,
    })
  })

  it("merges unused sessions and extends from the current end date", () => {
    const q = quotePlan(monthly12, "male", active, beforeEnd)
    expect(q.merge).toEqual({
      carriedOver: 3,
      totalSessions: 15,
      endDate: "2026-12-30",
      payBy: "2026-11-30",
    })
  })

  it("gives promotions no discount but still merges on time", () => {
    const q = quotePlan(promo6, "male", active, beforeEnd)
    expect(q).toMatchObject({ discount: 0, price: 1990, streakMonth: 1 })
    expect(q.merge?.totalSessions).toBe(75)
    expect(q.merge?.endDate).toBe("2027-05-30")
  })

  it("drops the discount and the merge once the plan has expired", () => {
    const q = quotePlan(monthly12, "male", active, afterEnd)
    expect(q).toMatchObject({ discount: 0, price: 390, merge: null })
  })
})
