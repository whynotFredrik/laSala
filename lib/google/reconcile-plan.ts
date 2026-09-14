/**
 * Pure diff used by the reconcile job: decides which local mapping rows
 * and which remote Google events no longer correspond to a live session.
 */

export type CalendarEventRowLite = {
  id: string
  session_id: string | null
  google_event_id: string
}

export type RemoteEventLite = {
  id: string
  sessionId: string | null
}

export type ReconcilePlan = {
  /** Local rows whose session is gone; their Google event must be deleted. */
  orphanRows: CalendarEventRowLite[]
  /** Google events tagged by us whose session no longer exists and that no
   *  orphan row already covers. */
  strayRemoteIds: string[]
}

export function planReconcile(input: {
  sessionIds: Set<string>
  rows: CalendarEventRowLite[]
  remote: RemoteEventLite[]
}): ReconcilePlan {
  const orphanRows = input.rows.filter(
    (r) => r.session_id === null || !input.sessionIds.has(r.session_id),
  )
  const coveredEventIds = new Set(orphanRows.map((r) => r.google_event_id))
  const liveEventIds = new Set(
    input.rows
      .filter((r) => r.session_id !== null && input.sessionIds.has(r.session_id))
      .map((r) => r.google_event_id),
  )

  const strayRemoteIds = input.remote
    .filter((e) => {
      if (liveEventIds.has(e.id)) return false
      if (coveredEventIds.has(e.id)) return false
      return e.sessionId === null || !input.sessionIds.has(e.sessionId)
    })
    .map((e) => e.id)

  return { orphanRows, strayRemoteIds }
}
