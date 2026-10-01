import { describe, expect, it } from "vitest"

import {
  agendaFor,
  toAgendaSessions,
  type AgendaSessionRow,
} from "./daily-agenda"

const booked = (full_name: string | null, email = "x@y.ro") => ({
  status: "booked",
  profiles: { full_name, email },
})

const rows: AgendaSessionRow[] = [
  {
    // 19:00 Bucharest (UTC+3 in October)
    start_at: "2026-10-02T16:00:00Z",
    end_at: "2026-10-02T17:00:00Z",
    capacity: 6,
    trainer: "Marina",
    classes: null,
    bookings: [
      booked("Ioana Pop"),
      { status: "cancelled", profiles: { full_name: "Ana Rus", email: "a@b.ro" } },
      booked(null, "fara.nume@ex.ro"),
    ],
  },
  {
    start_at: "2026-10-02T15:00:00Z",
    end_at: "2026-10-02T16:00:00Z",
    capacity: 4,
    trainer: "Eugen",
    classes: { name_ro: "Forță" },
    bookings: [],
  },
]

describe("toAgendaSessions", () => {
  const sessions = toAgendaSessions(rows)

  it("orders by start and formats studio-local times", () => {
    expect(sessions.map((s) => s.time)).toEqual(["18:00–19:00", "19:00–20:00"])
    expect(sessions[0]!.className).toBe("Forță")
    expect(sessions[1]!.className).toBe("Sesiune")
  })

  it("lists only active bookings, falling back to email", () => {
    expect(sessions[1]!.roster).toEqual(["fara.nume@ex.ro", "Ioana Pop"])
    expect(sessions[0]!.roster).toEqual([])
  })
})

describe("agendaFor", () => {
  const sessions = toAgendaSessions(rows)

  it("returns everything without a trainer filter", () => {
    expect(agendaFor(sessions, null)).toHaveLength(2)
  })

  it("keeps only the given trainer's sessions", () => {
    expect(agendaFor(sessions, "Eugen").map((s) => s.trainer)).toEqual([
      "Eugen",
    ])
  })
})
