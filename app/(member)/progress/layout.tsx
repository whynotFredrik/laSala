import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"

import { ProgressTabs } from "./progress-tabs"

export default async function ProgressLayout({
  children,
}: {
  children: ReactNode
}) {
  const t = await getTranslations("progress")
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
      </header>
      <ProgressTabs />
      <div>{children}</div>
    </div>
  )
}
