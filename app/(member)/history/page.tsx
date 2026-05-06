import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type BookingRow = Database["public"]["Tables"]["bookings"]["Row"]
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"]
type ClassRow = Database["public"]["Tables"]["classes"]["Row"]

type BookingWithSession = BookingRow & {
  sessions:
    | (Pick<SessionRow, "id" | "start_at" | "end_at"> & {
        classes: Pick<ClassRow, "name_ro"> | null
      })
    | null
}

function BookingItem({ b }: { b: BookingWithSession }) {
  if (!b.sessions) return null
  const start = new Date(b.sessions.start_at)
  return (
    <li className="flex items-center justify-between gap-3 rounded border p-3">
      <div className="space-y-0.5">
        <p className="font-medium">{b.sessions.classes?.name_ro ?? "Sesiune"}</p>
        <p className="text-sm text-muted-foreground">
          {format(start, "EEEE d MMM yyyy, HH:mm", { locale: ro })}
        </p>
      </div>
    </li>
  )
}

export default async function HistoryPage() {
  await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("historyPage")
  const nowIso = new Date().toISOString()

  const baseSelect =
    "*, sessions!inner(id, start_at, end_at, classes(name_ro))"

  const [{ data: upcoming }, { data: past }, { data: cancelled }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(baseSelect)
        .eq("status", "booked")
        .gte("sessions.start_at", nowIso)
        .order("start_at", { referencedTable: "sessions", ascending: true }),
      supabase
        .from("bookings")
        .select(baseSelect)
        .in("status", ["booked", "completed"])
        .lt("sessions.start_at", nowIso)
        .order("start_at", { referencedTable: "sessions", ascending: false }),
      supabase
        .from("bookings")
        .select(baseSelect)
        .eq("status", "cancelled")
        .order("start_at", { referencedTable: "sessions", ascending: false }),
    ])

  const upcomingList = (upcoming ?? []) as BookingWithSession[]
  const pastList = (past ?? []) as BookingWithSession[]
  const cancelledList = (cancelled ?? []) as BookingWithSession[]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("bookingHistory")}
        </h1>
      </header>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">{t("upcoming")}</TabsTrigger>
          <TabsTrigger value="past">{t("past")}</TabsTrigger>
          <TabsTrigger value="cancelled">{t("cancelled")}</TabsTrigger>
        </TabsList>

        {[
          { value: "upcoming", list: upcomingList },
          { value: "past", list: pastList },
          { value: "cancelled", list: cancelledList },
        ].map(({ value, list }) => (
          <TabsContent key={value} value={value}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {t(value as "upcoming" | "past" | "cancelled")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noHistory")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((b) => (
                      <BookingItem key={b.id} b={b} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
