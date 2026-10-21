import { describe, expect, it } from "vitest"

import { mapWithConcurrency, skipReasonFor } from "./recurring"

describe("skipReasonFor", () => {
  it("maps every book_session_for exception to a reason", () => {
    expect(skipReasonFor("Already booked for this date")).toBe("alreadyBooked")
    expect(skipReasonFor("Session is full")).toBe("sessionFull")
    expect(skipReasonFor("No active plan")).toBe("noActivePlan")
    expect(skipReasonFor("Plan expires before session date")).toBe(
      "planExpired",
    )
    expect(skipReasonFor("No sessions remaining on plan")).toBe(
      "noSessionsLeft",
    )
    expect(skipReasonFor("Membership frozen on session date")).toBe("frozen")
    expect(skipReasonFor("Admin only")).toBe("notAllowed")
    expect(skipReasonFor("permission denied for function")).toBe("notAllowed")
    expect(skipReasonFor("something else entirely")).toBe("unknown")
  })
})

describe("mapWithConcurrency", () => {
  it("keeps input order and never exceeds the limit", async () => {
    let inFlight = 0
    let peak = 0
    const result = await mapWithConcurrency(
      [5, 1, 4, 2, 3],
      2,
      async (n) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise((r) => setTimeout(r, n))
        inFlight--
        return n * 10
      },
    )
    expect(result).toEqual([50, 10, 40, 20, 30])
    expect(peak).toBe(2)
  })

  it("handles an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([])
  })
})
