import { describe, expect, it } from "vitest"

import type { PinOutcome } from "@/lib/booking/recurring"

import {
  buildWeeklySummary,
  formatSummaryLines,
  weeklySummaryDedupeKey,
} from "./weekly-summary"

const outcome = (over: Partial<PinOutcome>): PinOutcome => ({
  userId: "u1",
  sessionId: "s",
  templateId: "t",
  startAt: "2024-10-07T15:00:00Z", // Monday 18:00 Bucharest
  trainer: "Eugen",
  status: "booked",
  ...over,
})

describe("buildWeeklySummary", () => {
  it("orders by start, maps studio weekdays and flags grace", () => {
    const summary = buildWeeklySummary({
      booked: [
        {
          sessionId: "wed",
          startAt: "2024-10-09T15:00:00Z",
          trainer: "Eugen",
          grace: true,
        },
      ],
      outcomes: [
        outcome({ sessionId: "mon", startAt: "2024-10-07T15:00:00Z" }),
        outcome({
          sessionId: "fri",
          startAt: "2024-10-11T04:30:00Z", // 07:30 Bucharest
          status: "skipped",
          reason: "sessionFull",
        }),
      ],
    })
    expect(summary.booked.map((l) => [l.dayKey, l.time, l.grace])).toEqual([
      ["monday", "18:00", false],
      ["wednesday", "18:00", true],
    ])
    expect(summary.skipped.map((l) => [l.dayKey, l.time, l.reason])).toEqual([
      ["friday", "07:30", "sessionFull"],
    ])
  })

  it("counts `existing` outcomes as booked and collapses duplicates", () => {
    const summary = buildWeeklySummary({
      booked: [
        {
          sessionId: "mon",
          startAt: "2024-10-07T15:00:00Z",
          trainer: "Eugen",
          grace: false,
        },
      ],
      outcomes: [
        outcome({ sessionId: "mon", status: "existing" }),
        outcome({
          sessionId: "mon",
          status: "skipped",
          reason: "alreadyBooked",
        }),
      ],
    })
    expect(summary.booked).toHaveLength(1)
    expect(summary.skipped).toHaveLength(0)
  })

  it("uses the Sunday/Monday boundary of the studio, not UTC", () => {
    // Sunday 13 Oct 22:30 UTC is Monday 14 Oct 01:30 in Bucharest.
    const summary = buildWeeklySummary({
      booked: [],
      outcomes: [outcome({ startAt: "2024-10-13T22:30:00Z" })],
    })
    expect(summary.booked[0]?.dayKey).toBe("monday")
  })
})

describe("formatSummaryLines / weeklySummaryDedupeKey", () => {
  it("renders day, time, trainer, grace suffix and skip reason", () => {
    const summary = buildWeeklySummary({
      booked: [
        {
          sessionId: "a",
          startAt: "2024-10-07T15:00:00Z",
          trainer: "Marina",
          grace: true,
        },
      ],
      outcomes: [
        outcome({
          sessionId: "b",
          startAt: "2024-10-08T15:00:00Z",
          trainer: null,
          status: "skipped",
          reason: "noActivePlan",
        }),
      ],
    })
    const lines = formatSummaryLines(summary, {
      dayName: (k) => k.toUpperCase(),
      reasonText: (r) => `reason:${r}`,
      graceSuffix: "(grace)",
    })
    expect(lines.booked).toEqual(["MONDAY 18:00 · Marina (grace)"])
    expect(lines.skipped).toEqual(["TUESDAY 18:00 — reason:noActivePlan"])
    expect(weeklySummaryDedupeKey("2024-10-14")).toBe(
      "weekly_summary:2024-10-14",
    )
  })
})
