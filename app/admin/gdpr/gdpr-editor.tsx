"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { publishGdprAction } from "./actions"

function suggestNextVersion(current: string | null) {
  // bump trailing number if pattern is "<base>.N"; otherwise append "-2".
  if (!current) return "1.0"
  const m = current.match(/^(.*?)(\d+)$/)
  if (m) return `${m[1]}${Number(m[2]) + 1}`
  return `${current}-2`
}

export function GdprEditor({
  currentVersion,
  currentBody,
}: {
  currentVersion: string | null
  currentBody: string | null
}) {
  const t = useTranslations("adminGdpr")
  const [version, setVersion] = useState(suggestNextVersion(currentVersion))
  const [body, setBody] = useState(currentBody ?? "")
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      if (
        !confirm(
          t("publishConfirm", { version, current: currentVersion ?? "—" }),
        )
      )
        return
      const res = await publishGdprAction({ version, bodyMd: body })
      if (res.status === "error") toast.error(t(res.message as "save_failed"))
      else toast.success(t("published"))
    })

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="version">{t("newVersion")}</Label>
        <Input
          id="version"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">
          {t("currentVersionHint", { current: currentVersion ?? "—" })}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">{t("body")}</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-96 w-full rounded border bg-background p-2 font-mono text-xs"
        />
      </div>

      <Button type="button" onClick={submit} disabled={pending}>
        {t("publish")}
      </Button>
    </div>
  )
}
