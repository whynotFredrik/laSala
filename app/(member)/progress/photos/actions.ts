"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireUser } from "@/lib/auth/get-user"
import { createClient } from "@/lib/supabase/server"

export type PhotoUploadResult =
  | {
      status: "ok"
      uploads: Array<{
        view: "front" | "side" | "back"
        path: string
        token: string
      }>
    }
  | { status: "error"; message: string }

const startUploadSchema = z.object({
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  views: z.array(z.enum(["front", "side", "back"])).min(1).max(3),
})

/**
 * Step 1 of upload: server creates signed upload URLs for each requested view
 * (front/side/back). Client uploads the bytes directly to Supabase Storage,
 * then calls `commitProgressPhotosAction` with the resulting paths.
 */
export async function startProgressPhotoUploadAction(input: {
  takenOn: string
  views: Array<"front" | "side" | "back">
}): Promise<PhotoUploadResult> {
  const parsed = startUploadSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()

  const uploads: Array<{
    view: "front" | "side" | "back"
    path: string
    token: string
  }> = []

  for (const view of parsed.data.views) {
    // Path convention: <user_id>/<takenOn>/<view>-<random>.jpg
    // Storage RLS requires the first folder segment to be auth.uid().
    const random = crypto.randomUUID()
    const path = `${user.id}/${parsed.data.takenOn}/${view}-${random}.jpg`
    const { data, error } = await supabase.storage
      .from("progress-photos")
      .createSignedUploadUrl(path)
    if (error || !data) {
      return { status: "error", message: "signed_url_failed" }
    }
    uploads.push({ view, path: data.path, token: data.token })
  }

  return { status: "ok", uploads }
}

const commitSchema = z.object({
  takenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frontPath: z.string().nullable().optional(),
  sidePath: z.string().nullable().optional(),
  backPath: z.string().nullable().optional(),
  weightKg: z.coerce.number().min(20).max(300).optional(),
  note: z.string().max(280).optional(),
})

/**
 * Step 2: after the client has uploaded the bytes via the signed URLs,
 * insert the row in `progress_photos` referencing the storage paths.
 */
export async function commitProgressPhotoAction(input: {
  takenOn: string
  frontPath?: string | null
  sidePath?: string | null
  backPath?: string | null
  weightKg?: number
  note?: string
}) {
  const parsed = commitSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error" as const, message: "invalid_input" }
  }

  const { user } = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase.from("progress_photos").insert({
    user_id: user.id,
    taken_on: parsed.data.takenOn,
    front_path: parsed.data.frontPath ?? null,
    side_path: parsed.data.sidePath ?? null,
    back_path: parsed.data.backPath ?? null,
    weight_kg: parsed.data.weightKg ?? null,
    note: parsed.data.note ?? null,
  })
  if (error) {
    return { status: "error" as const, message: "save_failed" }
  }

  revalidatePath("/progress/photos")
  return { status: "ok" as const }
}

export async function deleteProgressPhotoAction(id: string) {
  const { user } = await requireUser()
  const supabase = await createClient()

  // Fetch the row first so we can clean up storage.
  const { data: row } = await supabase
    .from("progress_photos")
    .select("front_path, side_path, back_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (row) {
    const paths = [row.front_path, row.side_path, row.back_path].filter(
      (p): p is string => !!p,
    )
    if (paths.length) {
      await supabase.storage.from("progress-photos").remove(paths)
    }
  }

  await supabase
    .from("progress_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  revalidatePath("/progress/photos")
}
