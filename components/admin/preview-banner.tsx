import { getTranslations } from "next-intl/server"

import { Button } from "@/components/ui/button"
import { isAdminPreviewing } from "@/lib/auth/get-user"

import { exitMemberPreviewAction } from "@/app/admin/actions"

/**
 * Banner shown at the top of every member page when an admin has opted
 * into "member preview" mode. Server component — checks the cookie and
 * the caller's role server-side, no client JS needed.
 *
 * Returns null for genuine members so the layout stays clean.
 */
export async function AdminPreviewBanner() {
  const previewing = await isAdminPreviewing()
  if (!previewing) return null
  const t = await getTranslations("adminPreview")
  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
        <span>
          <strong>{t("title")}</strong> · {t("subtitle")}
        </span>
        <form action={exitMemberPreviewAction}>
          <Button type="submit" variant="outline" size="sm">
            {t("exit")}
          </Button>
        </form>
      </div>
    </div>
  )
}
