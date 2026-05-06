"use client"

import { useActionState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertTitle } from "@/components/ui/alert"

import { saveDietaryAction, type DietaryState } from "./actions"

const SECTIONS = [
  {
    key: "intolerances",
    fields: [
      "gluten_intolerance",
      "lactose_intolerance",
      "nut_allergy",
      "egg_allergy",
      "soy_allergy",
      "shellfish_allergy",
      "fish_allergy",
    ],
  },
  {
    key: "exclusions",
    fields: [
      "exclude_pork",
      "exclude_beef",
      "exclude_poultry",
      "exclude_seafood",
      "exclude_dairy",
      "exclude_eggs",
      "exclude_gluten",
      "exclude_soy",
      "exclude_nuts",
      "exclude_alcohol",
      "exclude_caffeine",
      "exclude_sugar",
      "exclude_processed_foods",
    ],
  },
  {
    key: "preferences",
    fields: [
      "vegetarian",
      "vegan",
      "pescatarian",
      "keto",
      "paleo",
      "low_carb",
      "low_fat",
      "high_protein",
    ],
  },
] as const

type FlagKey =
  | (typeof SECTIONS)[number]["fields"][number]

const initialState: DietaryState = { status: "idle" }

export function DietaryForm({
  defaults,
}: {
  defaults: Partial<Record<FlagKey, boolean>> & { additional_notes?: string | null }
}) {
  const t = useTranslations("dietary")
  const [state, action, pending] = useActionState(
    saveDietaryAction,
    initialState,
  )

  useEffect(() => {
    if (state.status === "ok") toast.success(t("savedTitle"))
    else if (state.status === "error") toast.error(t("saveFailed"))
  }, [state, t])

  return (
    <form action={action} className="space-y-6">
      {SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`section_${section.key}`)}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {section.fields.map((field) => (
              <label
                key={field}
                className="flex items-center gap-2 rounded border p-2 text-sm hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  name={field}
                  defaultChecked={defaults[field as FlagKey] ?? false}
                  className="size-4"
                />
                <span>{t(`field_${field}`)}</span>
              </label>
            ))}
          </div>
        </section>
      ))}

      <div className="space-y-2">
        <Label htmlFor="additional_notes">{t("notes")}</Label>
        <Input
          id="additional_notes"
          name="additional_notes"
          defaultValue={defaults.additional_notes ?? ""}
          maxLength={1000}
        />
      </div>

      {state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{t("saveFailed")}</AlertTitle>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  )
}
