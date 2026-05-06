"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient as createBrowserClient } from "@/lib/supabase/browser"

import {
  commitProgressPhotoAction,
  startProgressPhotoUploadAction,
} from "./actions"

const VIEWS = ["front", "side", "back"] as const
type View = (typeof VIEWS)[number]

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function PhotoUploader() {
  const t = useTranslations("progress")
  const [files, setFiles] = useState<Partial<Record<View, File>>>({})
  const [takenOn, setTakenOn] = useState(todayIsoDate())
  const [weightKg, setWeightKg] = useState("")
  const [note, setNote] = useState("")
  const [pending, start] = useTransition()

  const submit = () => {
    const views = (Object.keys(files) as View[]).filter((v) => files[v])
    if (views.length === 0) {
      toast.error(t("photoNoneSelected"))
      return
    }

    start(async () => {
      // 1. Ask the server for signed upload URLs.
      const init = await startProgressPhotoUploadAction({ takenOn, views })
      if (init.status !== "ok") {
        toast.error(t("saveFailed"))
        return
      }

      // 2. Upload each file via the signed URL using the browser client.
      const supabase = createBrowserClient()
      const pathsByView: Partial<Record<View, string>> = {}
      for (const upload of init.uploads) {
        const file = files[upload.view]
        if (!file) continue
        const { error } = await supabase.storage
          .from("progress-photos")
          .uploadToSignedUrl(upload.path, upload.token, file, {
            contentType: file.type,
            upsert: false,
          })
        if (error) {
          toast.error(t("saveFailed"))
          return
        }
        pathsByView[upload.view] = upload.path
      }

      // 3. Tell the server to insert the row.
      const result = await commitProgressPhotoAction({
        takenOn,
        frontPath: pathsByView.front ?? null,
        sidePath: pathsByView.side ?? null,
        backPath: pathsByView.back ?? null,
        weightKg: weightKg ? Number(weightKg) : undefined,
        note: note.trim() || undefined,
      })
      if (result.status === "ok") {
        toast.success(t("savedTitle"))
        setFiles({})
        setNote("")
        setWeightKg("")
      } else {
        toast.error(t("saveFailed"))
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="takenOn">{t("date")}</Label>
          <Input
            id="takenOn"
            type="date"
            value={takenOn}
            onChange={(e) => setTakenOn(e.target.value)}
            max={todayIsoDate()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightKg">{t("weightKgOptional")}</Label>
          <Input
            id="weightKg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="300"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {VIEWS.map((view) => (
          <div key={view} className="space-y-2">
            <Label htmlFor={`file-${view}`}>{t(`photo_${view}`)}</Label>
            <Input
              id={`file-${view}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0]
                setFiles((f) => ({ ...f, [view]: file }))
              }}
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">{t("noteOptional")}</Label>
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={280}
        />
      </div>

      <Button type="button" onClick={submit} disabled={pending}>
        {t("uploadPhotos")}
      </Button>
    </div>
  )
}
