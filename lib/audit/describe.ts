import { addDays, format, parseISO } from "date-fns"
import { ro } from "date-fns/locale"

import { formatStudio } from "@/lib/booking/format"

/**
 * Turns an `audit_log` row (migration 0031) into one readable line for the
 * admin history page. Pure — the caller passes a translator scoped to the
 * `adminHistory` namespace, so every word still comes from messages/ro.json.
 */

export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string

export type AuditEntry = {
  entity: string
  action: string
  details: unknown
}

type Obj = Record<string, unknown>

const asObj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {}

const str = (v: unknown): string =>
  v === null || v === undefined ? "—" : String(v)

/** Schedule template weekday: 0 = Monday .. 6 = Sunday. 2024-01-01 is a Monday. */
function weekdayName(dayOfWeek: unknown): string {
  const n = Number(dayOfWeek)
  if (!Number.isInteger(n) || n < 0 || n > 6) return "—"
  return format(addDays(new Date(2024, 0, 1), n), "EEEE", { locale: ro })
}

function hhmm(hour: unknown, minute: unknown): string {
  const pad = (v: unknown) => String(Number(v) || 0).padStart(2, "0")
  return `${pad(hour)}:${pad(minute)}`
}

function session(v: unknown): string {
  const s = asObj(v)
  if (typeof s.start_at !== "string") return "—"
  const when = formatStudio(s.start_at, "EEE d MMM, HH:mm")
  return s.trainer ? `${when} · ${str(s.trainer)}` : when
}

function slot(v: unknown, t: Translate): string {
  const s = asObj(v)
  const parts = [
    `${weekdayName(s.day_of_week)} ${hhmm(s.start_hour, s.start_minute)}`,
  ]
  if (s.trainer) parts.push(str(s.trainer))
  if (s.capacity !== undefined) {
    parts.push(t("slotCapacity", { capacity: str(s.capacity) }))
  }
  if (s.duration_min !== undefined) {
    parts.push(t("slotDuration", { minutes: str(s.duration_min) }))
  }
  if (s.is_enabled === false) parts.push(t("slotDisabled"))
  return parts.join(" · ")
}

function day(v: unknown): string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? format(parseISO(v), "d MMM yyyy", { locale: ro })
    : str(v)
}

const PLAN_FIELDS = new Set([
  "sessions_total",
  "sessions_used",
  "start_date",
  "end_date",
  "status",
  "is_active",
  "streak_month",
  "price_paid_ron",
  "discount_ron",
  "payment_method",
  "activated_at",
  "tier_id",
])

function planValue(field: string, v: unknown, t: Translate): string {
  if (field === "start_date" || field === "end_date") return day(v)
  if (field === "activated_at" && typeof v === "string") {
    return formatStudio(v, "d MMM yyyy, HH:mm")
  }
  if (typeof v === "boolean") return t(v ? "yes" : "no")
  return str(v)
}

function planChanges(v: unknown, t: Translate): string {
  return Object.entries(asObj(v))
    .filter(([field]) => PLAN_FIELDS.has(field) && field !== "tier_id")
    .map(([field, change]) => {
      const c = asObj(change)
      return `${t(`fields.${field}`)}: ${planValue(field, c.from, t)} → ${planValue(field, c.to, t)}`
    })
    .join("; ")
}

export function describeAudit(entry: AuditEntry, t: Translate): string {
  const d = asObj(entry.details)
  switch (entry.entity) {
    case "booking":
      switch (entry.action) {
        case "booked":
          return t("booking.booked", { session: session(d.session) })
        case "cancelled":
          return t("booking.cancelled", { session: session(d.session) })
        case "moved":
          return t("booking.moved", {
            from: session(d.from),
            to: session(d.to),
          })
        default:
          return t("booking.statusChanged", {
            session: session(d.session),
            from: t(`status.${str(d.from_status)}`),
            to: t(`status.${str(d.to_status)}`),
          })
      }
    case "schedule_slot":
      if (entry.action === "created") {
        return t("slot.created", { slot: slot(d.new, t) })
      }
      if (entry.action === "deleted") {
        return t("slot.deleted", { slot: slot(d.old, t) })
      }
      return t("slot.updated", { from: slot(d.old, t), to: slot(d.new, t) })
    case "recurring":
      return t(entry.action === "removed" ? "recurring.removed" : "recurring.created", {
        slot: slot(d.slot, t),
      })
    case "plan":
      if (entry.action === "created") {
        return t("plan.created", {
          tier: str(d.tier),
          total: str(d.sessions_total),
          start: day(d.start_date),
          end: day(d.end_date),
        })
      }
      return t("plan.updated", {
        tier: str(d.tier),
        changes: planChanges(d.changes, t) || "—",
      })
    case "plan_request":
      return t(`request.${["requested", "approved", "rejected", "cancelled"].includes(entry.action) ? entry.action : "other"}`, {
        tier: str(d.tier),
        reason: d.reason ? ` (${str(d.reason)})` : "",
      })
    case "freeze":
      return t(`freeze.${entry.action === "deleted" ? "deleted" : entry.action === "updated" ? "updated" : "created"}`, {
        start: day(d.start_date),
        end: day(d.end_date),
      })
    default:
      return `${entry.entity} · ${entry.action}`
  }
}
