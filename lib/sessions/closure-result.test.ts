import { describe, expect, it } from "vitest"

import {
  cancelledCountByUser,
  closeResultSchema,
  closureNotices,
  reopenResultSchema,
} from "./closure-result"

const booking = (id: string, user: string) => ({
  id,
  user_id: user,
  session_id: `s-${id}`,
  status: "cancelled",
  is_grace: false,
})

describe("closeResultSchema", () => {
  it("accepts the jsonb admin_close_studio_days returns (extra booking fields ignored)", () => {
    const parsed = closeResultSchema.parse({
      new_days: ["2026-12-01", "2026-12-02"],
      cancelled: [booking("b1", "u1")],
      extended: [
        {
          user_id: "u1",
          plan_id: "p1",
          days: 2,
          dates: ["2026-12-01", "2026-12-02"],
          end_date: "2026-12-03",
        },
      ],
    })
    expect(parsed.cancelled[0]).toEqual({
      id: "b1",
      user_id: "u1",
      session_id: "s-b1",
    })
    expect(parsed.extended[0]?.days).toBe(2)
  })

  it("rejects a malformed result", () => {
    expect(
      closeResultSchema.safeParse({ cancelled: [], extended: [] }).success,
    ).toBe(false)
    expect(reopenResultSchema.safeParse(null).success).toBe(false)
  })
})

describe("closureNotices", () => {
  const ext = (user: string, days = 1) => ({
    user_id: user,
    plan_id: `p-${user}`,
    days,
    dates: ["2026-12-01"],
    end_date: "2026-12-31",
  })

  it("attaches the member's extension to each of their cancelled bookings", () => {
    const notices = closureNotices({
      new_days: ["2026-12-01"],
      cancelled: [booking("b1", "u1"), booking("b2", "u1")],
      extended: [ext("u1", 2)],
    })
    expect(notices).toHaveLength(2)
    for (const n of notices) {
      expect(n.kind).toBe("cancelled")
      if (n.kind === "cancelled") expect(n.extension?.days).toBe(2)
    }
  })

  it("cancelled booking without an active plan running that day → no extension", () => {
    const notices = closureNotices({
      new_days: ["2026-12-01"],
      cancelled: [booking("b1", "u1")],
      extended: [],
    })
    expect(notices).toEqual([
      { kind: "cancelled", booking: expect.objectContaining({ id: "b1" }), extension: null },
    ])
  })

  it("extended members with no booking on the closed days get their own notice", () => {
    const notices = closureNotices({
      new_days: ["2026-12-01"],
      cancelled: [booking("b1", "u1")],
      extended: [ext("u1"), ext("u2")],
    })
    expect(notices.map((n) => n.kind)).toEqual(["cancelled", "extended"])
    const last = notices[1]
    expect(last?.kind === "extended" && last.extension.user_id).toBe("u2")
  })

  it("re-closing already closed days notifies nobody", () => {
    expect(
      closureNotices({ new_days: [], cancelled: [], extended: [] }),
    ).toEqual([])
  })
})

describe("cancelledCountByUser", () => {
  it("counts bookings per member", () => {
    const counts = cancelledCountByUser([
      { id: "b1", user_id: "u1", session_id: "s1" },
      { id: "b2", user_id: "u1", session_id: "s2" },
      { id: "b3", user_id: "u2", session_id: "s3" },
    ])
    expect(counts.get("u1")).toBe(2)
    expect(counts.get("u2")).toBe(1)
    expect(counts.get("u3")).toBeUndefined()
  })
})
