"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import { deleteProgressPhotoAction } from "./actions"

export function DeletePhotoButton({ id }: { id: string }) {
  const t = useTranslations("progress")
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={t("delete")}
      onClick={() => {
        if (!confirm(t("deleteConfirm"))) return
        start(() => deleteProgressPhotoAction(id))
      }}
    >
      <Trash2 />
    </Button>
  )
}
