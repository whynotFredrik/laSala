import { getTranslations } from "next-intl/server"

import { LocaleTester } from "@/components/locale-tester"

export default async function Home() {
  // Server Component path — `getTranslations` from `next-intl/server`.
  const t = await getTranslations("auth")

  return (
    <main className="font-sans flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("welcomeTitle")}
      </h1>
      <p className="text-muted-foreground">{t("welcomeSubtitle")}</p>

      {/* Client Component path — `useTranslations` from `next-intl`. */}
      <LocaleTester />
    </main>
  )
}
