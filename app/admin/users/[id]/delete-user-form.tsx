"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { deleteUserAction } from "./actions"

/**
 * Destructive-action UI for deleting a user. Behind a two-step reveal:
 *   1. Click "Delete user" — exposes the confirm form.
 *   2. Type the user's email exactly, then submit.
 *
 * The server action re-verifies the email server-side; this is just
 * client friction so a misclick can't blow away an account.
 */
export function DeleteUserForm({
  userId,
  email,
}: {
  userId: string
  email: string
}) {
  const t = useTranslations("adminUsers")
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")
  const [pending, startTransition] = useTransition()

  const canSubmit =
    confirm.trim().toLowerCase() === email.toLowerCase() && !pending

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await deleteUserAction(formData)
      // deleteUserAction redirects on success, so we only reach here on error.
      if (res?.status === "error") {
        toast.error(t(res.message))
      }
    })
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {t("deleteUser")}
      </Button>
    )
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded border border-destructive/40 bg-destructive/5 p-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">
          {t("deleteUserWarning")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("deleteUserHint", { email })}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmEmail" className="text-xs">
          {t("typeEmailToConfirm")}
        </Label>
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={email}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          size="sm"
          disabled={!canSubmit}
        >
          {pending ? t("deleting") : t("deleteUserConfirm")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false)
            setConfirm("")
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}
