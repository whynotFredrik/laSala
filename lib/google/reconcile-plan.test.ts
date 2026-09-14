import { describe, expect, it } from "vitest"

import { planReconcile } from "@/lib/google/reconcile-plan"

describe("planReconcile", () => {
  const rows = [
    { id: "r1", session_id: "s1", google_event_id: "e1" },
    { id: "r2", session_id: null, google_event_id: "e2" },
    { id: "r3", session_id: "s-deleted", google_event_id: "e3" },
  ]

  it("flags rows whose session is null or missing", () => {
    const plan = planReconcile({
      sessionIds: new Set(["s1"]),
      rows,
      remote: [],
    })
    expect(plan.orphanRows.map((r) => r.id)).toEqual(["r2", "r3"])
    expect(plan.strayRemoteIds).toEqual([])
  })

  it("flags remote events for unknown sessions, without double-deleting", () => {
    const plan = planReconcile({
      sessionIds: new Set(["s1"]),
      rows,
      remote: [
        { id: "e1", sessionId: "s1" }, // live
        { id: "e2", sessionId: null }, // covered by orphan row r2
        { id: "e9", sessionId: "s-gone" }, // stray, no row
        { id: "e8", sessionId: null }, // stray, no tag
      ],
    })
    expect(plan.strayRemoteIds).toEqual(["e9", "e8"])
  })
})
