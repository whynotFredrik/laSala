import { getTranslations } from "next-intl/server"

import type { Database } from "@/lib/supabase/database.types"

type DietaryRow = Database["public"]["Tables"]["dietary_questionnaires"]["Row"]

type Section = {
  key: "intolerances" | "exclusions" | "preferences"
  fields: ReadonlyArray<keyof DietaryRow>
}

const SECTIONS: Section[] = [
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
]

/**
 * Renders the dietary questionnaire as a readable list grouped by section.
 * Only "true" flags appear; sections with zero hits are skipped entirely
 * (no point telling the admin a member has "no intolerances" three times).
 *
 * Replaces the previous JSON dump that was unreadable at a glance.
 */
export async function DietarySummary({
  dietary,
}: {
  dietary: DietaryRow | null
}) {
  const t = await getTranslations("dietary")
  const tAdmin = await getTranslations("adminUsers")

  if (!dietary) {
    return (
      <p className="text-sm text-muted-foreground">{tAdmin("noQuestionnaire")}</p>
    )
  }

  // Pick the true flags per section.
  const sectionsWithHits = SECTIONS.map((section) => ({
    ...section,
    hits: section.fields.filter((f) => dietary[f] === true),
  })).filter((s) => s.hits.length > 0)

  if (sectionsWithHits.length === 0 && !dietary.additional_notes) {
    return (
      <p className="text-sm text-muted-foreground">
        {tAdmin("dietaryAllFalse")}
      </p>
    )
  }

  return (
    <div className="space-y-4 text-sm">
      {sectionsWithHits.map((section) => (
        <section key={section.key} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`section_${section.key}`)}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {section.hits.map((field) => (
              <li
                key={String(field)}
                className="rounded bg-muted px-2 py-0.5 text-xs"
              >
                {t(`field_${String(field)}`)}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {dietary.additional_notes ? (
        <section className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("notes")}
          </p>
          <p className="rounded bg-muted/40 p-2 text-sm">
            {dietary.additional_notes}
          </p>
        </section>
      ) : null}
    </div>
  )
}
