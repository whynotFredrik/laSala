import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BUSINESS } from "@/lib/constants"

/**
 * Payment info displayed alongside the plan list. Payment is in-person only —
 * card (POS) or cash at the studio. Admins approve the plan request after
 * receiving payment.
 */
export async function PayInfoCard() {
  const t = await getTranslations("plans")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("payInfoTitle")}</CardTitle>
        <CardDescription>{t("payInfoBody")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium">{t("inPersonTitle")}</p>
        <p className="text-muted-foreground">
          {BUSINESS.address} · {BUSINESS.phone}
        </p>
        <p className="text-muted-foreground">{t("inPersonBody")}</p>
      </CardContent>
    </Card>
  )
}
