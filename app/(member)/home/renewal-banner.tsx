import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import type { PlanWithTier } from "@/lib/plans/active"
import { remainingSessions, renewalReminderDue } from "@/lib/plans/rules"

/**
 * Persistent "renew now" nudge on the home page. Same rule as the
 * renewal-reminders cron (`renewalReminderDue`), shown until the member
 * has a queued plan or a pending request.
 */
export async function RenewalBanner({
  plan,
  queued,
  hasPendingRequest,
}: {
  plan: PlanWithTier | null
  queued: PlanWithTier | null
  hasPendingRequest: boolean
}) {
  if (!plan || queued || hasPendingRequest || !renewalReminderDue(plan)) {
    return null
  }
  const t = await getTranslations("home")
  const remaining = remainingSessions(plan)

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <AlertTitle>{t("renewalBannerTitle", { remaining })}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{t("renewalBannerBody")}</span>
        <Link
          href={`/plans?tier=${plan.tier_id}`}
          className={buttonVariants({ size: "sm" })}
        >
          {t("renewPlan")}
        </Link>
      </AlertDescription>
    </Alert>
  )
}
