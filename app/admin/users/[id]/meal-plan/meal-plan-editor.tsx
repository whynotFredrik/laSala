"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { publishMealPlanAction } from "./actions"

export function MealPlanEditor({ userId }: { userId: string }) {
  const t = useTranslations("adminMealPlans")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      const res = await publishMealPlanAction({
        userId,
        title: title.trim(),
        bodyMd: body,
      })
      if (res.status === "error") {
        toast.error(t("saveFailed"))
      } else {
        toast.success(t("published"))
        setTitle("")
        setBody("")
      }
    })

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="title">{t("title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("titlePlaceholder")}
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">{t("body")}</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-72 w-full rounded border bg-background p-2 font-mono text-xs"
          placeholder={t("bodyPlaceholder")}
        />
      </div>
      <Button
        type="button"
        onClick={submit}
        disabled={pending || !title.trim() || !body.trim()}
      >
        {t("publish")}
      </Button>
    </div>
  )
}
