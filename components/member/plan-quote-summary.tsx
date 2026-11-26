import { format, parseISO } from "date-fns"
import { ro } from "date-fns/locale"
import { useTranslations } from "next-intl"

import type { PlanQuote } from "@/lib/plans/quote"

function ron(amount: number): string {
  return `${amount.toLocaleString("ro-RO")} RON`
}

function day(date: string): string {
  return format(parseISO(date), "d MMMM yyyy", { locale: ro })
}

/**
 * Price breakdown of a plan request — base price, streak discount, amount
 * to pay — plus, for an on-time renewal, what the merged plan will hold.
 * Used in the request dialog and the pending-request card. Not async, so
 * it renders from both Server and Client Components.
 */
export function PlanQuoteSummary({ quote }: { quote: PlanQuote }) {
  const t = useTranslations("planQuote")

  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-1 rounded-lg border bg-muted/40 p-3">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("base")}</dt>
          <dd>{ron(quote.basePrice)}</dd>
        </div>
        {quote.discount > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">
              {t("discount", { month: quote.streakMonth })}
            </dt>
            <dd className="text-emerald-700 dark:text-emerald-400">
              −{ron(quote.discount)}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3 border-t pt-2">
          <dt className="font-medium">{t("total")}</dt>
          <dd className="text-xl font-semibold">{ron(quote.price)}</dd>
        </div>
      </dl>

      {quote.merge ? (
        <div className="space-y-1 text-muted-foreground">
          <p>
            {quote.merge.carriedOver > 0
              ? t("merge", {
                  carried: quote.merge.carriedOver,
                  total: quote.merge.totalSessions,
                  date: day(quote.merge.endDate),
                })
              : t("mergeNoCarry", {
                  total: quote.merge.totalSessions,
                  date: day(quote.merge.endDate),
                })}
          </p>
          <p className="font-medium text-foreground">
            {quote.discount > 0
              ? t("payByDiscount", { date: day(quote.merge.payBy) })
              : t("payBy", { date: day(quote.merge.payBy) })}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground">
          {t("fresh", { total: quote.tierSessions })}
        </p>
      )}
    </div>
  )
}
