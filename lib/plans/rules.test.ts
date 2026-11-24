import { describe, expect, it } from "vitest"

import {
  isPlanUsable,
  remainingSessions,
  renewalDedupeKey,
  renewalReminderDue,
  renewalThreshold,
  renewalWatchFor,
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

describe("renewalWatchFor", () => {
  const today = "2026-11-24"
  const plan = (used: number, total: number, end: string) => ({
    sessions_used: used,
    sessions_total: total,
    end_date: end,
  })

  it("skips plans with sessions and time to spare", () => {
    expect(renewalWatchFor(plan(5, 12, "2026-12-20"), today)).toBeNull()
    expect(renewalWatchFor(plan(9, 12, "2026-12-02"), today)).toBeNull()
  })

  it("lists plans with 2 sessions or fewer left", () => {
    expect(renewalWatchFor(plan(10, 12, "2026-12-20"), today)).toEqual({
      remaining: 2,
      daysLeft: 26,
      lowSessions: true,
      expiringSoon: false,
    })
    expect(renewalWatchFor(plan(12, 12, "2026-12-20"), today)?.remaining).toBe(0)
  })

  it("lists plans ending within 7 days, today and past dates included", () => {
    expect(renewalWatchFor(plan(2, 12, "2026-12-01"), today)).toEqual({
      remaining: 10,
      daysLeft: 7,
      lowSessions: false,
      expiringSoon: true,
    })
    expect(renewalWatchFor(plan(2, 12, "2026-11-24"), today)?.daysLeft).toBe(0)
    expect(renewalWatchFor(plan(2, 12, "2026-11-20"), today)?.daysLeft).toBe(-4)
  })

  it("flags both reasons at once", () => {
    const w = renewalWatchFor(plan(11, 12, "2026-11-26"), today)
    expect(w?.lowSessions).toBe(true)
    expect(w?.expiringSoon).toBe(true)
  })
})
