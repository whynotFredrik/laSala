import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  __setTokenGetterForTests,
  CalendarApiError,
  deleteEvent,
  insertEvent,
  listAppEvents,
  patchEvent,
} from "@/lib/google/calendar"

type MockResponse = { status: number; body?: unknown }

function mockFetch(responses: MockResponse[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error("unexpected fetch call")
    const text = next.body === undefined ? "" : JSON.stringify(next.body)
    return new Response(text, {
      status: next.status,
      headers: { "content-type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fn)
  return calls
}

const payload = {
  summary: "x",
  description: "",
  start: { dateTime: "2026-01-01T10:00:00.000Z", timeZone: "Europe/Bucharest" },
  end: { dateTime: "2026-01-01T11:00:00.000Z", timeZone: "Europe/Bucharest" },
  status: "confirmed" as const,
  extendedProperties: { private: { app: "lasala" as const, sessionId: "s" } },
  reminders: { useDefault: false as const },
}

beforeEach(() => {
  __setTokenGetterForTests(async () => "tok")
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  __setTokenGetterForTests(null)
})

describe("calendar client", () => {
  it("sends the bearer token and returns the inserted event", async () => {
    const calls = mockFetch([{ status: 200, body: { id: "e1", htmlLink: "h" } }])
    const ev = await insertEvent("cal@x", { ...payload, id: "e1" })
    expect(ev).toEqual({ id: "e1", htmlLink: "h" })
    expect(calls[0].url).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/cal%40x/events?sendUpdates=none",
    )
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer tok")
  })

  it("surfaces 409 as CalendarApiError with the reason", async () => {
    mockFetch([
      {
        status: 409,
        body: { error: { message: "dup", errors: [{ reason: "duplicate" }] } },
      },
    ])
    await expect(insertEvent("c", { ...payload, id: "e" })).rejects.toMatchObject({
      status: 409,
      reason: "duplicate",
    })
  })

  it("retries on 429 then succeeds", async () => {
    const calls = mockFetch([{ status: 429 }, { status: 200, body: { id: "e" } }])
    const p = patchEvent("c", "e", payload)
    await vi.runAllTimersAsync()
    await expect(p).resolves.toEqual({ id: "e" })
    expect(calls).toHaveLength(2)
  })

  it("does not retry a 403 that is not a rate limit", async () => {
    const calls = mockFetch([
      {
        status: 403,
        body: { error: { errors: [{ reason: "forbiddenForServiceAccounts" }] } },
      },
    ])
    await expect(patchEvent("c", "e", payload)).rejects.toBeInstanceOf(CalendarApiError)
    expect(calls).toHaveLength(1)
  })

  it("treats delete 410 as success", async () => {
    mockFetch([{ status: 410 }])
    await expect(deleteEvent("c", "e")).resolves.toBeUndefined()
  })

  it("paginates the list", async () => {
    const calls = mockFetch([
      { status: 200, body: { items: [{ id: "a" }], nextPageToken: "p2" } },
      { status: 200, body: { items: [{ id: "b" }] } },
    ])
    const out = await listAppEvents("c", {
      timeMin: new Date("2026-01-01T00:00:00Z"),
      timeMax: new Date("2026-01-02T00:00:00Z"),
    })
    expect(out.map((e) => e.id)).toEqual(["a", "b"])
    expect(calls[0].url).toContain("privateExtendedProperty=app%3Dlasala")
    expect(calls[1].url).toContain("pageToken=p2")
  })
})
