"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdmin } from "@/lib/auth/get-user"
import { createServiceClient } from "@/lib/supabase/service"

const schema = z.object({
  version: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, "version_invalid"),
  bodyMd: z.string().min(1).max(100_000),
})

export type GdprResult = { status: "ok" } | { status: "error"; message: string }

/**
 * Publishes a new GDPR document version. Flips the previous current row to
 * `is_current = false` (there's a partial unique index `gdpr_one_current` so
 * we can't have two current rows). Done with the service-role client because
 * the partial-unique-index dance needs to happen atomically and RLS for
 * admins is enforced via `requireAdmin`.
 */
export async function publishGdprAction(input: {
  version: string
  bodyMd: string
}): Promise<GdprResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { status: "error", message: first?.message ?? "invalid_input" }
  }

  await requireAdmin()
  const service = createServiceClient()

  // Demote any existing current row.
  const { error: demoteErr } = await service
    .from("gdpr_document")
    .update({ is_current: false })
    .eq("is_current", true)
  if (demoteErr) {
    return { status: "error", message: "save_failed" }
  }

  const { error } = await service.from("gdpr_document").insert({
    version: parsed.data.version,
    body_md: parsed.data.bodyMd,
    is_current: true,
  })
  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "version_taken" }
    }
    return { status: "error", message: "save_failed" }
  }

  revalidatePath("/admin/gdpr")
  revalidatePath("/profile")
  return { status: "ok" }
}
