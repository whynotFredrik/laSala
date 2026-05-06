import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BANK_DETAILS, BUSINESS } from "@/lib/constants"

/**
 * Payment info displayed alongside the plan list. No payment provider
 * integration in v1 — admins approve plan requests after receiving payment
 * via bank transfer, POS, or cash.
 */
export async function PayInfoCard() {
  const t = await getTranslations("plans")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("payInfoTitle")}</CardTitle>
        <CardDescription>{t("payInfoBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="font-medium">{t("bankTransfer")}</p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
            <dt>{t("beneficiary")}:</dt>
            <dd>{BANK_DETAILS.beneficiary}</dd>
            <dt>IBAN:</dt>
            <dd className="font-mono">{BANK_DETAILS.iban}</dd>
            {BANK_DETAILS.bank ? (
              <>
                <dt>{t("bank")}:</dt>
                <dd>{BANK_DETAILS.bank}</dd>
              </>
            ) : null}
            <dt>{t("reference")}:</dt>
            <dd>{BANK_DETAILS.reference}</dd>
          </dl>
        </div>
        <div>
          <p className="font-medium">{t("inPersonTitle")}</p>
          <p className="text-muted-foreground">
            {BUSINESS.address} · {BUSINESS.phone}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
