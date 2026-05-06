import Image from "next/image"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { getTranslations } from "next-intl/server"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

import { PhotoUploader } from "./photo-uploader"
import { DeletePhotoButton } from "./delete-button"

const SIGNED_URL_TTL_SEC = 60 * 60 // 1 hour

export default async function PhotosPage() {
  const { user } = await requireUser()
  const supabase = await createClient()
  const t = await getTranslations("progress")

  const { data: rows } = await supabase
    .from("progress_photos")
    .select("id, taken_on, front_path, side_path, back_path, weight_kg, note")
    .eq("user_id", user.id)
    .order("taken_on", { ascending: false })
    .limit(40)

  // Generate signed display URLs in one batched call per row.
  const list = await Promise.all(
    (rows ?? []).map(async (r) => {
      const paths = [r.front_path, r.side_path, r.back_path].filter(
        (p): p is string => !!p,
      )
      const { data } = paths.length
        ? await supabase.storage
            .from("progress-photos")
            .createSignedUrls(paths, SIGNED_URL_TTL_SEC)
        : { data: [] }
      const byPath = new Map(
        (data ?? []).map((d) => [d.path ?? "", d.signedUrl]),
      )
      return {
        ...r,
        front_url: r.front_path ? byPath.get(r.front_path) : null,
        side_url: r.side_path ? byPath.get(r.side_path) : null,
        back_url: r.back_path ? byPath.get(r.back_path) : null,
      }
    }),
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("uploadPhotos")}</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUploader />
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              {t("noPhotosYet")}
            </p>
          </CardContent>
        </Card>
      ) : (
        list.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {format(new Date(entry.taken_on), "d MMM yyyy", {
                    locale: ro,
                  })}
                  {entry.weight_kg
                    ? ` · ${Number(entry.weight_kg).toFixed(1)} kg`
                    : ""}
                </CardTitle>
                <DeletePhotoButton id={entry.id} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["front", "side", "back"] as const).map((view) => {
                  const url = entry[`${view}_url` as const]
                  if (!url) return null
                  return (
                    <figure key={view} className="space-y-1">
                      <div className="relative aspect-[3/4] overflow-hidden rounded border bg-muted">
                        <Image
                          src={url}
                          alt={t(`photo_${view}`)}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <figcaption className="text-center text-xs text-muted-foreground">
                        {t(`photo_${view}`)}
                      </figcaption>
                    </figure>
                  )
                })}
              </div>
              {entry.note ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {entry.note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
