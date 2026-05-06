# v1 Build Tasks

Work top-to-bottom. Each task is sized to be a single focused Claude Code session. Mark complete with `[x]` and a one-line note when done.

## Phase 0 — Project skeleton

- [ ] **0.1 Initialize Next.js project.** `pnpm create next-app@latest` with TypeScript, Tailwind, App Router, src dir disabled, `@/` alias yes, ESLint yes. Add `engines.node` to package.json.
- [ ] **0.2 Install core deps.** `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `date-fns-tz`, `resend`, `lucide-react`, `clsx`, `tailwind-merge`. Dev: `vitest`, `@playwright/test`.
- [ ] **0.3 Set up shadcn/ui.** `pnpm dlx shadcn@latest init` (slate base color, CSS variables on). Install primitives we'll need now: button, input, label, form, dialog, card, tabs, select, calendar, sonner, alert.
- [ ] **0.4 `.env.example`.** Document `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM_BOOKINGS`, `EMAIL_FROM_HELLO`, `CRON_SECRET`.
- [ ] **0.5 Supabase clients.** Create `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/service.ts` per `@supabase/ssr` docs. Export typed clients.
- [ ] **0.6 i18n setup.** `next-intl` configured for locale `ro` only at launch. `messages/ro.json` seeded from `assets/i18n/ro.json`. Verify `t()` works in a Server Component and a Client Component.

## Phase 1 — Database

- [ ] **1.1 Create Supabase project** in the Frankfurt region. Save URL + anon + service-role keys.
- [ ] **1.2 Run schema migration.** Paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor.
- [ ] **1.3 Run RLS policies migration.** `supabase/migrations/0002_rls.sql`.
- [ ] **1.4 Run booking functions migration.** `supabase/migrations/0003_functions.sql` (atomic book/cancel/reschedule).
- [ ] **1.5 Run seed.** `supabase/seed.sql` — plan tiers, default schedule template, GDPR text.
- [ ] **1.6 Generate types.** `pnpm supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts`.
- [ ] **1.7 Smoke test.** Insert a test user via Supabase Auth dashboard, run `select * from profiles where id = ...` to confirm the trigger created a profile row.

## Phase 2 — Auth and middleware

- [ ] **2.1 Sign-up / sign-in pages.** `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`. Email/password + Google OAuth button. GDPR consent checkbox on sign-up, persist consent timestamp in `profiles.gdpr_consented_at`.
- [ ] **2.2 OAuth callback route.** `app/auth/callback/route.ts` exchanges the code for a session.
- [ ] **2.3 Sign-out server action.**
- [ ] **2.4 Middleware.** `middleware.ts` redirects unauthenticated users from `(member)` and `(admin)` routes; redirects non-admins from `(admin)`. Reads role from `profiles` via the server-side Supabase client.
- [ ] **2.5 Forgot password.** Built-in Supabase magic link flow.

## Phase 3 — Member: home + booking

- [ ] **3.1 Home page.** `app/(member)/home/page.tsx` shows: greeting, current plan card (sessions remaining, expiry, freeze status), upcoming bookings list (next 3), CTA to book.
- [ ] **3.2 Book page.** `app/(member)/book/page.tsx` shows the next 7 days from today (or from next Monday if past Sunday unlock for next week). Each session: time, capacity, spots left, "Book" button. Sessions for week N+1 only appear after Sunday unlock — enforce both server-side via the function and client-side with a friendly message.
- [ ] **3.3 Book server action.** `app/(member)/book/actions.ts`: calls Postgres `book_session(session_id)`. Sends booking confirmation email on success.
- [ ] **3.4 Cancel server action.** Calls `cancel_booking(booking_id)`. Sends cancellation email.
- [ ] **3.5 Reschedule UI + action.** Modal to pick a new session, calls `reschedule_booking(booking_id, new_session_id)`.

## Phase 4 — Member: history, profile, freeze

- [ ] **4.1 History page.** Tabs: upcoming, past, cancelled. Filters by status from the bookings table.
- [ ] **4.2 Profile page.** Edit name/phone, change password (Supabase auth), GDPR document viewer.
- [ ] **4.3 Freeze membership UI.** Shows freeze allowance remaining (computed from `freeze_periods` over last 6 months). Form for start date + duration with client + server validation per domain rules.
- [ ] **4.4 Freeze server action.** Inserts into `freeze_periods` and updates plan end date in a transaction.

## Phase 5 — Plan request flow

- [ ] **5.1 Plans page.** `app/(member)/plans/page.tsx` lists tiers from `plan_tiers` table. Each tier has a "Request plan" button.
- [ ] **5.2 Plan request server action.** Inserts into `plan_requests` with status `pending`. Sends email to user (here's how to pay) and to admins (new request).
- [ ] **5.3 Pay-at-studio info card.** IBAN + studio address + "ask at the front desk" copy, displayed on plan request confirmation.

## Phase 6 — Progress tracking

- [ ] **6.1 Progress tab layout.** Tabs: weight, nutrition, photos, dietary questionnaire, TDEE.
- [ ] **6.2 Weight log.** List + add/delete entries, simple line chart (Recharts).
- [ ] **6.3 Nutrition log.** Daily kcal/protein/carbs/fat entry, list view.
- [ ] **6.4 Progress photos.** Upload via signed URL to Supabase Storage `progress-photos` bucket; list shows thumbnails (also signed); before/after comparison view.
- [ ] **6.5 Dietary questionnaire.** Form per `assets/dietary-questionnaire-fields.md`. Saves to `dietary_questionnaires` table.
- [ ] **6.6 TDEE calculator.** Mifflin-St Jeor formula, persists inputs + result on profile.

## Phase 7 — Admin

- [ ] **7.1 Admin dashboard.** `app/(admin)/dashboard/page.tsx` — total members, active plans, bookings this month, freeze count.
- [ ] **7.2 Users list + detail.** Search, view profile, view dietary questionnaire, manually adjust plan (edge cases).
- [ ] **7.3 Plan requests.** List of pending requests; approve/reject actions; on approve, plan is activated and confirmation email sent.
- [ ] **7.4 Schedule template.** Edit `schedule_template` rows: day of week, hour, capacity, enabled.
- [ ] **7.5 Generate week sessions.** Server action that reads template and creates session rows for next week. Idempotent (skips if a session at that slot already exists).
- [ ] **7.6 Sessions view.** Weekly calendar, each session shows roster of members.
- [ ] **7.7 Plan tiers editor.** Edit names, prices, session counts.
- [ ] **7.8 GDPR text editor.** Markdown-edit the document body, version-bumped on save.

## Phase 8 — Email + cron

- [ ] **8.1 Resend setup.** Verify `lasalastudio.ro` domain in Resend. Add SPF/DKIM DNS records.
- [ ] **8.2 Send wrapper.** `lib/email/send.ts` with typed templates from `lib/email/templates/`. All sends go through this; never call `resend.emails.send` directly elsewhere.
- [ ] **8.3 Booking confirmation email** — sent from `book_session` server action.
- [ ] **8.4 Plan request acknowledgment + admin notification.**
- [ ] **8.5 Plan approved email.**
- [ ] **8.6 Expiration warning cron.** `app/api/cron/expiration-warnings/route.ts` checks plans expiring in 7/3/1 days. Vercel cron daily at 09:00 Bucharest. Auth via `CRON_SECRET` header.
- [ ] **8.7 Low sessions warning cron.** Same pattern, fires when a member has ≤2 sessions remaining.

## Phase 9 — Public + PWA

- [ ] **9.1 Landing page.** `app/(marketing)/page.tsx` — hero, services list, contact, Instagram embed, Google Maps. Use copy + assets from `assets/business-constants.ts`.
- [ ] **9.2 Sitemap + robots.**
- [ ] **9.3 PWA manifest.** `public/manifest.json` with name, theme color, icons. Install prompt component.
- [ ] **9.4 Offline shell.** Minimal service worker (next-pwa) so the app icon launches the cached shell when offline.

## Phase 10 — Pre-launch

- [ ] **10.1 Vercel deploy.** Connect repo, set env vars, attach domain.
- [ ] **10.2 Lighthouse pass.** Mobile performance ≥85, accessibility ≥95.
- [ ] **10.3 Smoke test on a real phone.** Sign up, book a session, install as PWA.
- [ ] **10.4 Lawyer review of GDPR document.** Replace placeholders (address, phone, contact email) with real values; have a Romanian lawyer review.
- [ ] **10.5 Create real admin accounts** with strong passwords. Delete test accounts.
- [ ] **10.6 Backup plan.** Document the Supabase backup schedule and how to restore.
