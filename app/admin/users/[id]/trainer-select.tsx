"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { setUserTrainerAction } from "./actions"

const TRAINERS = ["Eugen", "Marina", "Ana"] as const

export function TrainerSelect({
  userId,
  current,
}: {
  userId: string
  current: string | null
}) {
  const t = useTranslations("adminUsers")
  const [pending, start] = useTransition()

  return (
    <Select
      value={current ?? undefined}
      onValueChange={(v) => {
        start(async () => {
          const res = await setUserTrainerAction({
            userId,
            trainer: v as (typeof TRAINERS)[number],
          })
          if (res.status === "error") toast.error(t("error"))
          else toast.success(t("trainerChanged"))
        })
      }}
      disabled={pending}
    >
      <SelectTrigger className="w-40">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {TRAINERS.map((trainer) => (
          <SelectItem key={trainer} value={trainer}>
            {trainer}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
