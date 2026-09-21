import { formatISO } from "date-fns"
import { describe, expect, it } from "vitest"

import {
  isCancellable,
  nextSevenDays,
  nextWeekDue,
  studioDateISO,
  studioWeekStart,
  unlockAtFor,
} from "./rules"

describe("unlockAtFor", () => {
  it("unlocks a Monday session at 00:00 Bucharest on the previous Sunday", () => {
    // Monday 7 Oct 2024, 18:00 Bucharest (EEST, UTC+3).
    const session = new Date("2024-10-07T15:00:00Z")
    // Sunday 6 Oct 2024 00:00 EEST = 5 Oct 21:00 UTC.
    expect(unlockAtFor(session).toISOString()).toBe("2024-10-05T21:00:00.000Z")
  })

  it("unlocks a Sunday session together with the rest of its week", () => {
    // Sunday 13 Oct 2024, 10:00 Bucharest.
    const session = new Date("2024-10-13T07:00:00Z")
    expect(unlockAtFor(session).toISOString()).toBe("2024-10-05T21:00:00.000Z")
  })

  it("stays at Bucharest midnight across the DST switch", () => {
    // Monday 31 Mar 2025. Unlock is Sunday 30 Mar 00:00 — DST starts at
    // 03:00 that day, so midnight is still EET (UTC+2): 29 Mar 22:00 UTC.
    const session = new Date("2025-03-31T15:00:00Z")
    expect(unlockAtFor(session).toISOString()).toBe("2025-03-29T22:00:00.000Z")
  })
})

describe("isCancellable", () => {
  const start = new Date("2024-10-07T15:00:00Z")
  it("is locked exactly 3 hours before start", () => {
    expect(isCancellable(start, new Date("2024-10-07T12:00:00Z"))).toBe(false)
  })
  it("is cancellable one millisecond earlier", () => {
    expect(isCancellable(start, new Date("2024-10-07T11:59:59.999Z"))).toBe(
      true,
    )
  })
})

describe("nextSevenDays / studioDateISO", () => {
  it("starts on the studio-local date even when UTC is still yesterday", () => {
    // 22:30 UTC on 6 Oct = 01:30 on 7 Oct in Bucharest.
    const now = new Date("2024-10-06T22:30:00Z")
    const days = nextSevenDays(now)
    expect(days).toHaveLength(7)
    expect(days[0]).toBe("2024-10-07")
    expect(days[6]).toBe("2024-10-13")
    expect(studioDateISO(now)).toBe("2024-10-07")
  })
})

describe("studioWeekStart", () => {
  const monday = (d: Date) =>
    formatISO(studioWeekStart(d), { representation: "date" })
  it("returns the Monday of the studio week", () => {
    expect(monday(new Date("2024-10-09T12:00:00Z"))).toBe("2024-10-07") // Wed
    expect(monday(new Date("2024-10-13T12:00:00Z"))).toBe("2024-10-07") // Sun
  })
  it("uses the Bucharest date, not UTC", () => {
    // Sunday 6 Oct 23:30 UTC is already Monday 7 Oct in Bucharest.
    expect(monday(new Date("2024-10-06T23:30:00Z"))).toBe("2024-10-07")
  })
})

describe("nextWeekDue", () => {
  it("is true on Saturday and Sunday (studio time)", () => {
    expect(nextWeekDue(new Date("2024-10-05T10:00:00Z"))).toBe(true) // Sat
    expect(nextWeekDue(new Date("2024-10-06T10:00:00Z"))).toBe(true) // Sun
    // Friday 22:00 UTC is Saturday 01:00 in Bucharest.
    expect(nextWeekDue(new Date("2024-10-04T22:00:00Z"))).toBe(true)
  })
  it("is false Monday to Friday", () => {
    expect(nextWeekDue(new Date("2024-10-07T10:00:00Z"))).toBe(false) // Mon
    expect(nextWeekDue(new Date("2024-10-11T10:00:00Z"))).toBe(false) // Fri
  })
})
