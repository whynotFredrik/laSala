/**
 * Business and domain constants for Lasala Fitness Studio.
 * Single source of truth for things referenced across the app.
 */

export const BUSINESS = {
  name: "Lasala Fitness Studio",
  tagline: "Calisthenics Studio",
  address: "Str. Evreilor Deportați 14, Oradea",
  city: "Oradea",
  country: "Romania",
  phone: "0770 431 340",
  phoneIntl: "+40770431340",
  email: "hello@lasalastudio.ro",
  domain: "lasalastudio.ro",
  mapQuery: "Str.+Evreilor+Deportati+14+Oradea+Romania",
  instagram: "https://instagram.com/lasalastudio.oradea",
  instagramHandle: "@lasalastudio.oradea",
  facebook: "https://facebook.com/lasalafitness",
  whatsapp: "https://wa.me/40770431340",
} as const

export const EMAIL_SENDERS = {
  bookings: "Lasala Studio <bookings@lasalastudio.ro>",
  hello: "Lasala Studio <hello@lasalastudio.ro>",
  payments: "Lasala Studio <payments@lasalastudio.ro>",
} as const

/**
 * Domain rule constants. Authoritative checks live in the Postgres functions;
 * these mirror them for client-side hints and pure validation in
 * `lib/booking/rules.ts`.
 */
export const RULES = {
  CANCEL_HOURS_BEFORE_SESSION: 3,
  RESCHEDULE_LIMIT_PER_WEEK: 2,
  FREEZE_MIN_DAYS: 3,
  FREEZE_MAX_DAYS: 14,
  FREEZE_TOTAL_DAYS_PER_6_MONTHS: 14,
  FREEZE_ADVANCE_NOTICE_HOURS: 48,
  TIMEZONE: "Europe/Bucharest",
} as const

/**
 * Trainer roster. Members are NOT assigned to a trainer — which sessions
 * they see and book is derived from their sex via `trainersForSex`:
 *
 * - Men → Eugen's sessions.
 * - Women → Marina's and Ana's sessions.
 *
 * Adding a trainer = add to this list + update the `trainer` check
 * constraints on `schedule_template` and `sessions` in a new migration.
 */
export const TRAINERS = {
  male: ["Eugen"],
  female: ["Marina", "Ana"],
} as const

export const ALL_TRAINERS: readonly Trainer[] = [
  ...TRAINERS.male,
  ...TRAINERS.female,
]

/**
 * Trainers whose sessions a member of the given sex sees. `null` (sex not
 * set yet) means no filter — every trainer.
 */
export function trainersForSex(sex: Sex | null | undefined): readonly Trainer[] {
  if (sex === "male") return TRAINERS.male
  if (sex === "female") return TRAINERS.female
  return ALL_TRAINERS
}

export type Sex = "male" | "female"
export type Trainer =
  | (typeof TRAINERS.male)[number]
  | (typeof TRAINERS.female)[number]

/**
 * Site URL helper. Some env-var setups omit the scheme — return a
 * well-formed URL string regardless. Use this anywhere we'd otherwise call
 * `new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "...")`.
 */
export function siteUrl(): string {
  const raw =
    (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lasalastudio.ro").trim()
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, "")
  return `https://${raw}`.replace(/\/$/, "")
}

/**
 * Bank transfer details for plan payment instructions.
 * TODO: replace placeholders with real values before launch.
 */
export const BANK_DETAILS = {
  beneficiary: "Lasala Fitness Studio S.R.L.",
  iban: "RO00 BANK 0000 0000 0000 0000",
  bank: "",
  swift: "",
  reference: "ABONAMENT {plan} - {member_name}",
} as const

/**
 * Per-trainer colors, used wherever a session time is shown so members and
 * admins can tell at a glance whose slot is whose. Full class strings (not
 * built dynamically) so Tailwind picks them up.
 */
export const TRAINER_COLORS: Record<
  Trainer,
  { badge: string; accent: string }
> = {
  Eugen: {
    badge: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
    accent: "border-l-blue-500",
  },
  Marina: {
    badge:
      "bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/30 dark:text-fuchsia-200",
    accent: "border-l-fuchsia-500",
  },
  Ana: {
    badge:
      "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    accent: "border-l-amber-500",
  },
}

export function trainerColors(
  trainer: string | null | undefined,
): { badge: string; accent: string } {
  if (trainer && trainer in TRAINER_COLORS) {
    return TRAINER_COLORS[trainer as Trainer]
  }
  return { badge: "bg-muted text-muted-foreground", accent: "border-l-border" }
}
