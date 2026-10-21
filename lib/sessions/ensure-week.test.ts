import { describe, expect, it } from "vitest"

import type { createServiceClient } from "@/lib/supabase/service"

import { ensureSessionsForWeek } from "./ensure-week"

type Row = Record<string, unknown>

/**
 * Just enough of the Supabase query builder for `ensureSessionsForWeek`:
 * select with eq/gte/lte/order, a bulk insert returning rows, and update.
 * Counts round trips so the test can prove the per-slot loop is gone.
 */
function fakeService(tables: Record<string, Row[]>) {
  let roundTrips = 0
  let nextId = 1

  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = []
    let pendingInsert: Row[] | null = null
    let pendingUpdate: Row | null = null

    const run = () => {
      roundTrips++
      const rows = tables[table] ?? (tables[table] = [])
      if (pendingInsert) {
        const inserted = pendingInsert.map((r) => ({
          id: `new-${nextId++}`,
          ...r,
          // Postgres echoes timestamps with a +00:00 offset.
          start_at: String(r.start_at).replace("Z", "+00:00"),
        }))
        rows.push(...inserted)
        return { data: inserted, error: null }
      }
      const matched = rows.filter((r) => filters.every((f) => f(r)))
      if (pendingUpdate) {
        for (const r of matched) Object.assign(r, pendingUpdate)
        return { data: null, error: null }
      }
      return { data: matched, error: null }
    }

    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (col: string, v: unknown) => {
        filters.push((r) => r[col] === v)
        return builder
      },
      gte: (col: string, v: string) => {
        filters.push((r) => String(r[col]) >= v)
        return builder
      },
      lte: (col: string, v: string) => {
        filters.push((r) => String(r[col]) <= v)
        return builder
      },
      insert: (rows: Row[]) => {
        pendingInsert = rows
        return builder
      },
      update: (patch: Row) => {
        pendingUpdate = patch
        return builder
      },
      then: (
        resolve: (v: { data: unknown; error: null }) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(run()).then(resolve, reject),
    }
    return builder
  }

  return {
    client: { from } as unknown as ReturnType<typeof createServiceClient>,
    roundTrips: () => roundTrips,
    tables,
  }
}

const template: Row[] = [
  // Monday 07:00 Eugen, Monday 07:00 Marina, Wednesday 18:00 Ana
  { id: "t1", day_of_week: 0, start_hour: 7, start_minute: 0, duration_min: 60, capacity: 6, class_id: null, trainer: "Eugen", is_enabled: true },
  { id: "t2", day_of_week: 0, start_hour: 7, start_minute: 0, duration_min: 60, capacity: 6, class_id: null, trainer: "Marina", is_enabled: true },
  { id: "t3", day_of_week: 2, start_hour: 18, start_minute: 0, duration_min: 60, capacity: 6, class_id: null, trainer: "Ana", is_enabled: true },
]

// Saturday Oct 24 2026, 07:00 Bucharest: inside the week of Mon Oct 19.
const anchor = new Date("2026-10-24T04:00:00Z")

describe("ensureSessionsForWeek", () => {
  it("creates every slot of an empty week in a constant number of queries", async () => {
    const svc = fakeService({ schedule_template: [...template], sessions: [] })
    const res = await ensureSessionsForWeek(svc.client, anchor)

    expect(res.weekStart).toBe("2026-10-19")
    expect(res.created).toBe(3)
    expect(res.skipped).toBe(0)
    expect(res.sessionIds).toHaveLength(3)
    // template + week read + one bulk insert
    expect(svc.roundTrips()).toBe(3)

    const sessions = svc.tables.sessions!
    expect(sessions.map((s) => s.session_date)).toEqual([
      "2026-10-19",
      "2026-10-19",
      "2026-10-21",
    ])
    // 07:00 Bucharest in October (EEST, UTC+3) = 04:00Z
    expect(sessions[0]!.start_at).toBe("2026-10-19T04:00:00.000+00:00")
  })

  it("is idempotent and keeps existing rows (Postgres +00:00 timestamps)", async () => {
    const svc = fakeService({ schedule_template: [...template], sessions: [] })
    const first = await ensureSessionsForWeek(svc.client, anchor)
    const second = await ensureSessionsForWeek(svc.client, anchor)

    expect(second.created).toBe(0)
    expect(second.skipped).toBe(3)
    expect(second.sessionIds).toEqual(first.sessionIds)
    expect(svc.tables.sessions).toHaveLength(3)
  })

  it("fills only missing slots and heals a missing template link", async () => {
    const svc = fakeService({
      schedule_template: [...template],
      sessions: [
        {
          id: "old",
          session_date: "2026-10-19",
          start_at: "2026-10-19T04:00:00+00:00",
          trainer: "Eugen",
          schedule_template_id: null,
        },
      ],
    })
    const res = await ensureSessionsForWeek(svc.client, anchor)

    expect(res.created).toBe(2)
    expect(res.skipped).toBe(1)
    expect(res.sessionIds[0]).toBe("old")
    expect(svc.tables.sessions![0]!.schedule_template_id).toBe("t1")
  })
})
