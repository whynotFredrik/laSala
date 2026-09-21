import { describe, expect, it } from "vitest"

import { skipReasonFor } from "./recurring"

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
    expect(
      skipReasonFor("Grace bookings exhausted, please renew plan"),
    ).toBe("graceExhausted")
    expect(skipReasonFor("Admin only")).toBe("notAllowed")
    expect(skipReasonFor("permission denied for function")).toBe("notAllowed")
    expect(skipReasonFor("something else entirely")).toBe("unknown")
  })
})
