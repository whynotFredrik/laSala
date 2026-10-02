import Link from "next/link"
import { addDays, formatISO, parseISO } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { getTranslations } from "next-intl/server"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { describeAudit, type Translate } from "@/lib/audit/describe"
import { formatStudio } from "@/lib/booking/format"
import { STUDIO_TZ } from "@/lib/booking/rules"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 100

/** Filter tabs → audit_log.entity values. */
const TYPES = {
  bookings: ["booking"],
  schedule: ["schedule_slot", "recurring"],
  plans: ["plan", "plan_request", "freeze"],
} as const
type TypeKey = keyof typeof TYPES

const isType = (v: string | undefined): v is TypeKey =>
  v !== undefined && v in TYPES

const isUuid = (v: string | undefined): v is string =>
  !!v && /^[0-9a-f-]{36}$/i.test(v)

const isDay = (v: string | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

type Person = { id?: string; full_name: string | null; email: string; role?: string }

const nameOf = (p: Person | null) => p?.full_name?.trim() || p?.email || ""

/**
 * Change history: who changed what and when — bookings, schedule,
 * recurring pins, plans, plan requests and freezes. Rows are written by
 * the audit triggers (migration 0031); this page only reads them.
 */
export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; type?: string; day?: string; page?: string }>
}) {
  const sp = await searchParams
  const member = isUuid(sp.member) ? sp.member : undefined
  const type = isType(sp.type) ? sp.type : undefined
  const dayFilter = isDay(sp.day) ? sp.day : undefined
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)

  const supabase = await createClient()
  const t = await getTranslations("adminHistory")
  // Keys are built from audit data (entity/action), so they can't be
  // checked statically; describeAudit only produces keys present in ro.json.
  const tr: Translate = (key, values) => t(key as "title", values)

  let query = supabase
    .from("audit_log")
    .select(
      "id, created_at, actor_id, member_id, entity, action, details, actor:profiles!audit_log_actor_id_fkey(full_name, email, role), member:profiles!audit_log_member_id_fkey(id, full_name, email)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  if (member) query = query.eq("member_id", member)
  if (type) query = query.in("entity", [...TYPES[type]])
  if (dayFilter) {
    const start = fromZonedTime(`${dayFilter}T00:00:00`, STUDIO_TZ)
    const nextDay = formatISO(addDays(parseISO(dayFilter), 1), {
      representation: "date",
    })
    const end = fromZonedTime(`${nextDay}T00:00:00`, STUDIO_TZ)
    query = query
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
  }
  const { data } = await query
  const rows = (data ?? []).slice(0, PAGE_SIZE)
  const hasMore = (data?.length ?? 0) > PAGE_SIZE

  const { data: memberProfile } = member
    ? await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", member)
        .maybeSingle()
    : { data: null }

  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { member, type, day: dayFilter, ...overrides }
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v)
    const qs = params.toString()
    return qs ? `/admin/history?${qs}` : "/admin/history"
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href={href({ type: undefined, page: undefined })}
          className={buttonVariants({ variant: type ? "outline" : "default", size: "sm" })}
        >
          {t("types.all")}
        </Link>
        {(Object.keys(TYPES) as TypeKey[]).map((k) => (
          <Link
            key={k}
            href={href({ type: k, page: undefined })}
            className={buttonVariants({ variant: type === k ? "default" : "outline", size: "sm" })}
          >
            {t(`types.${k}`)}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-2" method="get">
        {member ? <input type="hidden" name="member" value={member} /> : null}
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <div className="space-y-2">
          <Label htmlFor="day">{t("day")}</Label>
          <Input id="day" name="day" type="date" defaultValue={dayFilter ?? ""} />
        </div>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          {t("apply")}
        </button>
        {dayFilter ? (
          <Link href={href({ day: undefined })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            {t("clearDay")}
          </Link>
        ) : null}
      </form>

      {member ? (
        <p className="text-sm">
          {t("filteredMember", { name: nameOf(memberProfile) || "—" })}{" "}
          <Link href={href({ member: undefined })} className="underline">
            {t("showAll")}
          </Link>
        </p>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => {
                const actor = r.actor as Person | null
                const subject = r.member as Person | null
                const by = !r.actor_id
                  ? t("byAutomatic")
                  : r.actor_id === r.member_id
                    ? t("byMember")
                    : actor?.role === "admin"
                      ? t("byAdmin", { name: nameOf(actor) })
                      : nameOf(actor)
                return (
                  <li key={r.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
                    <time
                      dateTime={r.created_at}
                      className="text-xs tabular-nums text-muted-foreground sm:pt-0.5"
                    >
                      {formatStudio(r.created_at, "d MMM yyyy, HH:mm")}
                    </time>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm">
                        {subject?.id ? (
                          <>
                            <Link href={href({ member: subject.id, page: undefined })} className="font-medium hover:underline">
                              {nameOf(subject)}
                            </Link>
                            {" · "}
                          </>
                        ) : r.member_id === null && r.entity !== "schedule_slot" ? (
                          <span className="text-muted-foreground">{t("deletedMember")} · </span>
                        ) : null}
                        {describeAudit(r, tr)}
                      </p>
                      <p className="text-xs text-muted-foreground">{by}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {page > 1 || hasMore ? (
        <div className="flex justify-between">
          {page > 1 ? (
            <Link href={href({ page: String(page - 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("newer")}
            </Link>
          ) : <span />}
          {hasMore ? (
            <Link href={href({ page: String(page + 1) })} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {t("older")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
