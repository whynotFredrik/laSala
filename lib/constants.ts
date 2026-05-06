/**
 * Business and domain constants for Lasala Fitness Studio.
 * Single source of truth for things referenced across the app.
 */

export const BUSINESS = {
  name: "Lasala Fitness Studio",
  tagline: "Personal Training & Transformare",
  address: "Str. Evreilor Deportați 14, Oradea",
  city: "Oradea",
  country: "Romania",
  phone: "0770 431 340",
  phoneIntl: "+40770431340",
  email: "hello@lasalastudio.ro",
  domain: "lasalastudio.ro",
  mapQuery: "Str.+Evreilor+Deportati+14+Oradea+Romania",
  instagram: "https://instagram.com/lasalafitness",
  instagramHandle: "@lasalafitness",
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
