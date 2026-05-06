# Dietary Questionnaire Fields

Reference for the questionnaire form. The Postgres table `dietary_questionnaires` has
one boolean column per item plus `additional_notes` (text). Group these in the UI as
shown below.

## Section 1 — Intoleranțe alimentare (Food intolerances)

- `gluten_intolerance` — Intoleranță la gluten
- `lactose_intolerance` — Intoleranță la lactoză
- `nut_allergy` — Alergie la nuci
- `egg_allergy` — Alergie la ouă
- `soy_allergy` — Alergie la soia
- `shellfish_allergy` — Alergie la crustacee
- `fish_allergy` — Alergie la pește

## Section 2 — Alimente de exclus (Foods to exclude)

- `exclude_pork` — Porc
- `exclude_beef` — Vită
- `exclude_poultry` — Pasăre
- `exclude_seafood` — Fructe de mare
- `exclude_dairy` — Lactate
- `exclude_eggs` — Ouă
- `exclude_gluten` — Gluten
- `exclude_soy` — Soia
- `exclude_nuts` — Nuci
- `exclude_alcohol` — Alcool
- `exclude_caffeine` — Cafeină
- `exclude_sugar` — Zahăr
- `exclude_processed_foods` — Alimente procesate

## Section 3 — Preferințe dietetice (Dietary preferences)

- `vegetarian` — Vegetarian
- `vegan` — Vegan
- `pescatarian` — Pescatarian
- `keto` — Keto
- `paleo` — Paleo
- `low_carb` — Low-carb
- `low_fat` — Low-fat
- `high_protein` — High-protein

## Free text

- `additional_notes` — Note suplimentare (textarea, optional)

## UI suggestions

- Use a single form with three collapsible sections (or step-by-step on mobile).
- Default all booleans to `false`. Server inserts a row on first save.
- The `vegan` checkbox should auto-imply `exclude_dairy`, `exclude_eggs`, `exclude_seafood`, `exclude_pork`, `exclude_beef`, `exclude_poultry` — but show them as still toggleable so the member can override.
- Persist on every change via debounced server action, or have an explicit "Salvează" button. Either is fine; do not require a full-form submit per change.
