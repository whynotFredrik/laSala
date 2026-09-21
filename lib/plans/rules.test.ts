import { describe, expect, it } from "vitest"

import {
  isPlanUsable,
  remainingSessions,
  renewalDedupeKey,
  renewalReminderDue,
  renewalThreshold,
} from "./rules"

describe("renewalThreshold", () => {
  it("is 3 sessions for 12-session plans and bigger", () => {
    expect(renewalThreshold(12)).toBe(3)
    expect(renewalThreshold(16)).toBe(3)
    expect(renewalThreshold(48)).toBe(3)
  })
  it("is 2 sessions for 8-session plans and smaller", () => {
    expect(renewalThreshold(8)).toBe(2)
    expect(renewalThreshold(10)).toBe(2)
    expect(renewalThreshold(6)).toBe(2)
  })
})

describe("renewalReminderDue", () => {
  const plan = (total: number, used: number) => ({
    end_date: "2099-01-01",
    sessions_total: total,
    sessions_used: used,
  })
  it("fires from the threshold down to zero remaining", () => {
    expect(renewalReminderDue(plan(12, 8))).toBe(false) // 4 left
    expect(renewalReminderDue(plan(12, 9))).toBe(true) // 3 left
    expect(renewalReminderDue(plan(12, 11))).toBe(true) // 1 left
    expect(renewalReminderDue(plan(12, 12))).toBe(true) // 0 left
    expect(renewalReminderDue(plan(8, 5))).toBe(false) // 3 left
    expect(renewalReminderDue(plan(8, 6))).toBe(true) // 2 left
  })
  it("never fires on inconsistent data (used > total)", () => {
    expect(renewalReminderDue(plan(8, 9))).toBe(false)
  })
})

describe("isPlanUsable", () => {
  it("is usable on its last day and with one session left", () => {
    const plan = { end_date: "2024-10-31", sessions_total: 8, sessions_used: 7 }
    expect(isPlanUsable(plan, "2024-10-31")).toBe(true)
    expect(isPlanUsable(plan, "2024-11-01")).toBe(false)
    expect(isPlanUsable({ ...plan, sessions_used: 8 }, "2024-10-31")).toBe(
      false,
    )
  })
})

describe("remainingSessions / renewalDedupeKey", () => {
  it("never goes negative and keys on plan + remaining", () => {
    expect(
      remainingSessions({ end_date: "", sessions_total: 8, sessions_used: 9 }),
    ).toBe(0)
    expect(renewalDedupeKey("abc", 2)).toBe("renewal:abc:2")
  })
})
