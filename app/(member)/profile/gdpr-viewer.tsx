import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

/**
 * Renders the current GDPR document body (markdown) with the version number
 * and the date the user consented (from `profiles`). RLS allows anyone to
 * read the row where `is_current = true`.
 */
export async function GdprViewer({
  consentedAt,
  consentedVersion,
}: {
  consentedAt: string | null
  consentedVersion: string | null
}) {
  const t = await getTranslations("profilePage")
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("gdpr_document")
    .select("version, body_md")
    .eq("is_current", true)
    .maybeSingle()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gdprTitle")}</CardTitle>
        <CardDescription>
          {doc?.version ? `${t("currentVersion")}: ${doc.version}` : ""}
          {consentedAt ? (
            <>
              {" · "}
              {t("consentedOn")}:{" "}
              {format(new Date(consentedAt), "d MMM yyyy", { locale: ro })}
              {consentedVersion ? ` (v${consentedVersion})` : ""}
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs leading-relaxed">
          {doc?.body_md ?? t("gdprMissing")}
        </pre>
      </CardContent>
    </Card>
  )
}
