import { describe, expect, it } from "vitest"

import {
  buildEventPayload,
  deriveEventId,
  hashPayload,
  type SessionForCalendar,
} from "@/lib/google/event-payload"

const base: SessionForCalendar = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  // 2026-03-29 is the DST switch in Romania (EET -> EEST at 03:00).
  // 18:00 Bucharest on that day is 15:00 UTC.
  start_at: "2026-03-29T15:00:00.000Z",
  end_at: "2026-03-29T16:00:00.000Z",
  capacity: 6,
  booked_count: 2,
  trainer: "Marina",
  className: "Pilates",
  roster: ["Popescu Ion", "Andrei Maria"],
}
const adminUrl = "https://example.com/admin/sessions"

describe("deriveEventId", () => {
  it("strips dashes into 32 base32hex chars", () => {
    const id = deriveEventId(base.id)
    expect(id).toBe("3f2504e04f8911d39a0c0305e82c3301")
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/)
  })

  it("is stable and changes with salt", () => {
    expect(deriveEventId(base.id)).toBe(deriveEventId(base.id))
    const salted = deriveEventId(base.id, 1)
    expect(salted).toHaveLength(32)
    expect(salted).toMatch(/^[a-v0-9]+$/)
    expect(salted).not.toBe(deriveEventId(base.id))
    expect(salted).not.toBe(deriveEventId(base.id, 2))
  })
})

describe("buildEventPayload", () => {
  it("renders Bucharest time in the summary and keeps UTC instants", () => {
    const p = buildEventPayload(base, adminUrl)
    expect(p.summary).toBe("18:00 Marina – Pilates (2/6)")
    expect(p.start).toEqual({
      dateTime: "2026-03-29T15:00:00.000Z",
      timeZone: "Europe/Bucharest",
    })
    expect(p.end.dateTime).toBe("2026-03-29T16:00:00.000Z")
    expect(p.colorId).toBe("3")
    expect(p.extendedProperties.private).toEqual({
      app: "lasala",
      sessionId: base.id,
    })
    expect(p.reminders).toEqual({ useDefault: false })
    expect(p).not.toHaveProperty("attendees")
  })

  it("sorts the roster and appends the admin link", () => {
    const p = buildEventPayload(base, adminUrl)
    expect(p.description).toBe(`Andrei Maria\nPopescu Ion\n\n${adminUrl}`)
  })

  it("omits missing trainer/class and colorId", () => {
    const p = buildEventPayload(
      { ...base, trainer: null, className: null, roster: [] },
      adminUrl,
    )
    expect(p.summary).toBe("18:00 (2/6)")
    expect(p.colorId).toBeUndefined()
    expect(p.description).toBe(adminUrl)
  })
})

describe("hashPayload", () => {
  it("is independent of key order and sensitive to content", () => {
    const a = buildEventPayload(base, adminUrl)
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(a).reverse())),
    )
    expect(hashPayload(reordered)).toBe(hashPayload(a))
    const b = buildEventPayload({ ...base, booked_count: 3 }, adminUrl)
    expect(hashPayload(b)).not.toBe(hashPayload(a))
  })
})
