"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ALL_TRAINERS } from "@/lib/constants"

import {
  addAgendaRecipientAction,
  removeAgendaRecipientAction,
} from "./actions"

export type AgendaRecipient = {
  id: string
  email: string
  trainer: string | null
}

/**
 * Dashboard box: addresses that get tomorrow's schedule by email every
 * evening. Each one can follow the whole studio or a single trainer.
 */
export default function AgendaRecipients({
  recipients,
}: {
  recipients: AgendaRecipient[]
}) {
  const t = useTranslations("adminAgenda")
  const [email, setEmail] = useState("")
  const [trainer, setTrainer] = useState("")
  const [pending, start] = useTransition()

  const add = () =>
    start(async () => {
      const res = await addAgendaRecipientAction({
        email,
        trainer: trainer || null,
      })
      if (res.status === "error") {
        toast.error(t(res.message))
        return
      }
      toast.success(t("added"))
      setEmail("")
      setTrainer("")
    })

  const remove = (r: AgendaRecipient) => {
    if (!confirm(t("removeConfirm", { email: r.email }))) return
    start(async () => {
      const res = await removeAgendaRecipientAction(r.id)
      if (res.status === "error") toast.error(t(res.message))
      else toast.success(t("removed"))
    })
  }

  return (
    <div className="space-y-4">
      {recipients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="divide-y rounded border">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.email}</p>
                <p className="text-xs text-muted-foreground">
                  {r.trainer
                    ? t("onlyTrainer", { trainer: r.trainer })
                    : t("allTrainers")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(r)}
                disabled={pending}
              >
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          type="email"
          required
          placeholder={t("emailPlaceholder")}
          aria-label={t("email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="h-9 rounded border bg-background px-2 text-sm"
          aria-label={t("trainer")}
          value={trainer}
          onChange={(e) => setTrainer(e.target.value)}
        >
          <option value="">{t("allTrainers")}</option>
          {ALL_TRAINERS.map((tr) => (
            <option key={tr} value={tr}>
              {t("onlyTrainer", { trainer: tr })}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pending || !email.trim()}>
          {t("add")}
        </Button>
      </form>
    </div>
  )
}
