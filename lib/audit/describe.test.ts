import { describe, expect, it } from "vitest"

import ro from "@/messages/ro.json"

import { describeAudit, type Translate } from "./describe"

/** Minimal next-intl stand-in over the real adminHistory messages. */
const t: Translate = (key, values = {}) => {
  let node: unknown = ro.adminHistory
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part]
  }
  if (typeof node !== "string") throw new Error(`missing message: ${key}`)
  return node.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))
}

describe("describeAudit", () => {
  it("describes a moved booking with both sessions in studio time", () => {
    expect(
      describeAudit(
        {
          entity: "booking",
          action: "moved",
          details: {
            from: { start_at: "2026-09-29T15:00:00Z", trainer: "Marina" },
            to: { start_at: "2026-09-30T16:00:00Z", trainer: "Marina" },
          },
        },
        t,
      ),
    ).toBe("Rezervare mutată: mar 29 sep, 18:00 · Marina → mie 30 sep, 19:00 · Marina")
  })

  it("describes a schedule slot change", () => {
    const old = { day_of_week: 1, start_hour: 18, start_minute: 0, trainer: "Eugen", capacity: 6, duration_min: 60, is_enabled: true }
    expect(
      describeAudit(
        {
          entity: "schedule_slot",
          action: "updated",
          details: { old, new: { ...old, start_hour: 19, is_enabled: false } },
        },
        t,
      ),
    ).toBe(
      "Slot modificat în orar: marți 18:00 · Eugen · 6 locuri · 60 min → marți 19:00 · Eugen · 6 locuri · 60 min · dezactivat",
    )
  })

  it("lists only meaningful plan field changes", () => {
    expect(
      describeAudit(
        {
          entity: "plan",
          action: "updated",
          details: {
            tier: "Lunar 8",
            changes: {
              sessions_used: { from: 3, to: 2 },
              end_date: { from: "2026-10-01", to: "2026-10-15" },
              tier_id: { from: "a", to: "b" },
            },
          },
        },
        t,
      ),
    ).toBe(
      "Abonament modificat (Lunar 8): ședințe folosite: 3 → 2; valabil până: 1 oct 2026 → 15 oct 2026",
    )
  })

  it("resolves every entity/action the triggers emit to a message", () => {
    const cases: [string, string][] = [
      ["booking", "booked"],
      ["booking", "cancelled"],
      ["booking", "status_changed"],
      ["schedule_slot", "created"],
      ["schedule_slot", "deleted"],
      ["recurring", "created"],
      ["recurring", "removed"],
      ["plan", "created"],
      ["plan_request", "requested"],
      ["plan_request", "approved"],
      ["plan_request", "rejected"],
      ["plan_request", "cancelled"],
      ["plan_request", "pending"],
      ["freeze", "created"],
      ["freeze", "updated"],
      ["freeze", "deleted"],
    ]
    for (const [entity, action] of cases) {
      expect(() =>
        describeAudit(
          { entity, action, details: { from_status: "booked", to_status: "no_show" } },
          t,
        ),
      ).not.toThrow()
    }
  })
})
