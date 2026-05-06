import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

import { GdprEditor } from "./gdpr-editor"

export default async function AdminGdprPage() {
  const supabase = await createClient()
  const t = await getTranslations("adminGdpr")

  const { data: current } = await supabase
    .from("gdpr_document")
    .select("version, body_md")
    .eq("is_current", true)
    .maybeSingle()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{t("editTitle")}</CardTitle>
          <CardDescription>{t("editDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <GdprEditor
            currentVersion={current?.version ?? null}
            currentBody={current?.body_md ?? null}
          />
        </CardContent>
      </Card>
    </div>
  )
}
