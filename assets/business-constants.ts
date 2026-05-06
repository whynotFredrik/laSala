/**
 * Business constants for Lasala Fitness Studio.
 * Extracted from the previous app's landing page. Drop into `lib/constants.ts`
 * (or split across config files) when wiring up the new project.
 */

export const BUSINESS = {
  name: 'Lasala Fitness Studio',
  tagline: 'Personal Training & Transformare',
  address: 'Str. Evreilor Deportați 14, Oradea',
  city: 'Oradea',
  country: 'Romania',
  phone: '0770 431 340',
  phoneIntl: '+40770431340',
  email: 'hello@lasalastudio.ro',
  domain: 'lasalastudio.ro',
  // For Google Maps embed / link
  mapQuery: 'Str.+Evreilor+Deportati+14+Oradea+Romania',
  // Social
  instagram: 'https://instagram.com/lasalafitness',
  instagramHandle: '@lasalafitness',
  facebook: 'https://facebook.com/lasalafitness',
  whatsapp: 'https://wa.me/40770431340',
} as const;

/**
 * Sender addresses for transactional email (must be verified domains in Resend).
 */
export const EMAIL_SENDERS = {
  bookings: 'Lasala Studio <bookings@lasalastudio.ro>',
  hello: 'Lasala Studio <hello@lasalastudio.ro>',
  payments: 'Lasala Studio <payments@lasalastudio.ro>',
} as const;

/**
 * Services shown on the public landing page.
 * Icon names are lucide-react identifiers.
 */
export const SERVICES = [
  {
    icon: 'Dumbbell',
    title: 'Personal Training',
    desc: 'Antrenamente 1-la-1 personalizate pentru obiectivele tale',
  },
  {
    icon: 'Users',
    title: 'Antrenamente în Grup',
    desc: 'Sesiuni de grup motivante și energizante',
  },
  {
    icon: 'Apple',
    title: 'Nutriție & Dietă',
    desc: 'Planuri alimentare adaptate stilului tău de viață',
  },
  {
    icon: 'PersonStanding',
    title: 'Transformare Corporală',
    desc: 'Programe complete pentru slăbit sau masă musculară',
  },
  {
    icon: 'Zap',
    title: 'HIIT & Cardio',
    desc: 'Antrenamente intense pentru arderea grăsimilor',
  },
] as const;

/**
 * Domain rule constants. Single source of truth for client-side hints; the
 * authoritative checks live in the Postgres functions (book_session, etc.).
 */
export const RULES = {
  CANCEL_HOURS_BEFORE_SESSION: 3,
  RESCHEDULE_LIMIT_PER_WEEK: 2,
  FREEZE_MIN_DAYS: 3,
  FREEZE_MAX_DAYS: 14,
  FREEZE_TOTAL_DAYS_PER_6_MONTHS: 14,
  FREEZE_ADVANCE_NOTICE_HOURS: 48,
  TIMEZONE: 'Europe/Bucharest',
} as const;

/**
 * Bank transfer details for plan payment instructions.
 * TODO: replace with real values before launch.
 */
export const BANK_DETAILS = {
  beneficiary: 'Lasala Fitness Studio S.R.L.', // verify actual entity
  iban: 'RO00 BANK 0000 0000 0000 0000', // PLACEHOLDER
  bank: '', // PLACEHOLDER
  swift: '', // PLACEHOLDER
  reference: 'ABONAMENT {plan} - {member_name}', // template the user follows
} as const;
