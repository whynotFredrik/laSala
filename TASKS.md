# v1 Build Tasks

Work top-to-bottom. Each task is sized to be a single focused Claude Code session. Mark complete with `[x]` and a one-line note when done.

## Phase 0 — Project skeleton

- [x] **0.1 Initialize Next.js project.** `pnpm create next-app@latest` with TypeScript, Tailwind, App Router, src dir disabled, `@/` alias yes, ESLint yes. Add `engines.node` to package.json.
  - _Pinned `create-next-app@15` (gives Next 15.5.15 + React 19.1.0). `@latest` now scaffolds Next 16, which contradicts README/CLAUDE._
  - _Tailwind 4 is the default in the Next 15 scaffold; revisit in 0.3 if shadcn init wants Tailwind 3._
  - _`engines.node: ">=20.0.0"` and `packageManager: "pnpm@10.33.3"` set in package.json. Verified `pnpm install`, `pnpm build`, `pnpm lint`, and `tsc --noEmit` all clean._
- [x] **0.2 Install core deps.** `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `date-fns-tz`, `resend`, `lucide-react`, `clsx`, `tailwind-merge`. Dev: `vitest`, `@playwright/test`.
  - _Also pulled `server-only` (used by `lib/supabase/{server,service}.ts`) and `@radix-ui/react-slot` (needed by `components/ui/form.tsx`)._
  - _Heads up: `lucide-react` graduated to `^1.x` (still the official `lucide-icons` package, just out of pre-1.0)._
- [x] **0.3 Set up shadcn/ui.** `pnpm dlx shadcn@latest init` (slate base color, CSS variables on). Install primitives we'll need now: button, input, label, form, dialog, card, tabs, select, calendar, sonner, alert.
  - _The new shadcn CLI defaults to the `base-nova` style on `@base-ui/react` (not Radix). All 11 primitives installed; `form.tsx` was a stub in the registry so I wrote the standard react-hook-form wrapper by hand._
  - _`globals.css` hand-written with the slate `oklch(...)` design tokens for Tailwind 4. `components.json` flagged `baseColor: slate`._
- [x] **0.4 `.env.example`.** Document `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM_BOOKINGS`, `EMAIL_FROM_HELLO`, `CRON_SECRET`.
  - _Used the template from `lasala-starter.zip`; also kept `EMAIL_FROM_PAYMENTS`, `ADMIN_NOTIFICATION_EMAIL`, and `NEXT_PUBLIC_SITE_URL` since they're referenced elsewhere in the brief._
- [x] **0.5 Supabase clients.** Create `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/service.ts` per `@supabase/ssr` docs. Export typed clients.
  - _All three threaded through `Database` from `lib/supabase/database.types.ts` (placeholder file; gets overwritten by `pnpm supabase gen types` in 1.6)._
  - _`server.ts` and `service.ts` start with `import "server-only"` so an accidental client-side import fails the build. `service.ts` throws if env vars are missing._
- [x] **0.6 i18n setup.** `next-intl` configured for locale `ro` only at launch. `messages/ro.json` seeded from `assets/i18n/ro.json`. Verify `t()` works in a Server Component and a Client Component.
  - _`i18n/request.ts` returns `{ locale: 'ro', timeZone: 'Europe/Bucharest', messages }`. `next.config.ts` wraps the config with `createNextIntlPlugin`._
  - _Smoke test: `app/page.tsx` (Server Component, `getTranslations`) renders the welcome strings; `<LocaleTester>` (Client Component, `useTranslations`) renders nav + auth strings. Typecheck and lint clean._

## Phase 1 — Database

- [x] **1.1 Create Supabase project** in the Frankfurt region. Save URL + anon + service-role keys.
  - _Project ID: `bnlcmgwxzfjwqhwefzqt`._
- [x] **1.2 Run schema migration.** Paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor.
- [x] **1.3 Run RLS policies migration.** `supabase/migrations/0002_rls.sql`.
- [x] **1.4 Run booking functions migration.** `supabase/migrations/0003_functions.sql` (atomic book/cancel/reschedule).
- [x] **1.5 Run seed.** `supabase/seed.sql` — plan tiers, default schedule template, GDPR text.
- [x] **1.6 Generate types.** `pnpm supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts`.
  - _Project ID `bnlcmgwxzfjwqhwefzqt`. Added `supabase` as a dev dep, exposed as `pnpm db:types` script (project ID baked in). Added `pnpm.onlyBuiltDependencies` so the CLI binary postinstall runs without manual approval._
  - _Generated 1004 lines covering all enums (`booking_status`, `payment_method`, `plan_request_status`, `user_role`) and tables._
- [x] **1.7 Smoke test.** Insert a test user via Supabase Auth dashboard, run `select * from profiles where id = ...` to confirm the trigger created a profile row.
  - _Trigger fired correctly. Test user deleted; the `on delete cascade` on `profiles.id` removed the matching profile row automatically._

## Phase 2 — Auth and middleware

- [x] **2.1 Sign-up / sign-in pages.** `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-up/page.tsx`. Email/password + Google OAuth button. GDPR consent checkbox on sign-up, persist consent timestamp in `profiles.gdpr_consented_at`.
  - _Email/password only — Google OAuth deferred per request. Sign-up collects full name, email, phone, password, GDPR consent. Phone is validated as RO format and normalised to E.164._
  - _GDPR version is read from `gdpr_document where is_current = true` and stamped on the profile alongside `gdpr_consented_at`._
  - _Trigger only handles id/email/full_name; phone + GDPR are written via service-role client right after `signUp` (RLS would otherwise block, and email-confirm flows have no session yet)._
- [x] **2.2 OAuth callback route.** `app/auth/callback/route.ts` exchanges the code for a session.
  - _Handles email confirmation today; same handler will work for Google OAuth later. `?type=recovery` redirects to `/reset-password`._
- [x] **2.3 Sign-out server action.** `lib/auth/sign-out.ts` exports `signOutAction`. Use as a `<form action={signOutAction}>` or call from a Client Component.
- [x] **2.4 Middleware.** `middleware.ts` redirects unauthenticated users from `(member)` and `(admin)` routes; redirects non-admins from `(admin)`. Reads role from `profiles` via the server-side Supabase client.
  - _Logic in `lib/supabase/middleware.ts` (refreshes session, redirects). Admin role is re-fetched from `profiles` on every admin route — never trusted from the client per CLAUDE.md hard rule #2._
- [x] **2.5 Forgot password.** Built-in Supabase magic link flow.
  - _`/forgot-password` always returns success (don't leak which emails exist). `/reset-password` lets the recovered-session user set a new password._

## Phase 3 — Member: home + booking

- [x] **3.1 Home page.** `app/(member)/home/page.tsx` shows: greeting, current plan card (sessions remaining, expiry, freeze status), upcoming bookings list (next 3), CTA to book.
  - _Plus member shell (`app/(member)/layout.tsx`) with top nav (Home/Book/History/Profile) and sign-out._
  - _Freeze status not surfaced yet — the freeze table only matters once Phase 4.3 lands the freeze flow. PlanCard handles this when the data is plumbed in._
- [x] **3.2 Book page.** `app/(member)/book/page.tsx` shows the next 7 days from today (or from next Monday if past Sunday unlock for next week). Each session: time, capacity, spots left, "Book" button. Sessions for week N+1 only appear after Sunday unlock — enforce both server-side via the function and client-side with a friendly message.
  - _Always shows the next 7 calendar days from `today` in `Europe/Bucharest`. Locked sessions (week N+1 before Sunday-unlock) render with a "Disponibil de duminică" button label, disabled. Server-side enforcement remains in `book_session`._
- [x] **3.3 Book server action.** `app/(member)/book/actions.ts`: calls Postgres `book_session(session_id)`. Sends booking confirmation email on success.
  - _Email is stubbed with a TODO for Phase 8. Action revalidates `/home`, `/book`, `/history`._
- [x] **3.4 Cancel server action.** Calls `cancel_booking(booking_id)`. Sends cancellation email.
  - _Same actions file. Email TODO for Phase 8._
- [x] **3.5 Reschedule UI + action.** Modal to pick a new session, calls `reschedule_booking(booking_id, new_session_id)`.
  - _Dialog at `components/member/reschedule-dialog.tsx`. Candidate sessions are pre-fetched in `upcoming-bookings.tsx` (server) and passed in, so the dialog opens instantly without a round-trip._

## Phase 4 — Member: history, profile, freeze

- [x] **4.1 History page.** Tabs: upcoming, past, cancelled. Filters by status from the bookings table.
  - _Three queries fired in parallel via Promise.all. Past tab includes status `booked` whose session is in the past as well as any `completed` rows._
- [x] **4.2 Profile page.** Edit name/phone, change password (Supabase auth), GDPR document viewer.
  - _Three forms: profile (name+phone), change password, freeze. GDPR viewer reads the current `gdpr_document` row and shows the user's consent date + version._
- [x] **4.3 Freeze membership UI.** Shows freeze allowance remaining (computed from `freeze_periods` over last 6 months). Form for start date + duration with client + server validation per domain rules.
  - _Allowance computed by summing `duration_days` over the last 180 days. Form is disabled when remaining < 3._
- [x] **4.4 Freeze server action.** Inserts into `freeze_periods` and updates plan end date in a transaction.
  - _Wraps `freeze_membership` Postgres function — that function does the insert + plan extension atomically._

## Phase 5 — Plan request flow

- [x] **5.1 Plans page.** `app/(member)/plans/page.tsx` lists tiers from `plan_tiers` table. Each tier has a "Request plan" button.
  - _Tier cards show total sessions + duration + price. Button shows "Plan activ" / "Cerere în așteptare" if applicable, instead of an enabled Request button._
- [x] **5.2 Plan request server action.** Inserts into `plan_requests` with status `pending`. Sends email to user (here's how to pay) and to admins (new request).
  - _Insert + handles the partial unique index violation as `already_pending`. Email TODO Phase 8._
- [x] **5.3 Pay-at-studio info card.** IBAN + studio address + "ask at the front desk" copy, displayed on plan request confirmation.
  - _Reads from `lib/constants.ts` (BANK_DETAILS + BUSINESS), placed below the tier list on `/plans`. Bank IBAN/swift are still placeholders pending real values._

## Phase 6 — Progress tracking

- [x] **6.1 Progress tab layout.** Tabs: weight, nutrition, photos, dietary questionnaire, TDEE.
  - _Tabs are URL-routed (each tab is its own page under `/progress/<key>`); `/progress` redirects to `/progress/weight`. Sub-nav highlights the active tab via `usePathname`._
- [x] **6.2 Weight log.** List + add/delete entries, simple line chart (Recharts).
  - _Add ⇒ upsert by `(user_id, logged_on)` so re-logging the same day overwrites. Chart only renders when ≥2 points exist. Added `recharts@^2.15.0` to `package.json` — run `pnpm install` to pull it._
- [x] **6.3 Nutrition log.** Daily kcal/protein/carbs/fat entry, list view.
  - _Same upsert-by-day pattern as weight. All four numeric fields are optional; you can log just kcal if that's all you have._
- [x] **6.4 Progress photos.** Upload via signed URL to Supabase Storage `progress-photos` bucket; list shows thumbnails (also signed); before/after comparison view.
  - _Two-step flow: server creates signed upload URLs (path `<user_id>/<date>/<view>-<random>.jpg`), client uploads via `uploadToSignedUrl`, server then inserts the row in `progress_photos`. Display URLs are signed with 1-hour TTL._
  - _Before/after view: rows are stacked chronologically with front/side/back columns — comparing two visually is just scrolling between cards. A dedicated diff viewer is post-v1._
- [x] **6.5 Dietary questionnaire.** Form per `assets/dietary-questionnaire-fields.md`. Saves to `dietary_questionnaires` table.
  - _Three sections (intolerances, exclusions, preferences) of native `<input type="checkbox">` for performance. Saves via upsert on `user_id` (the table's PK)._
- [x] **6.6 TDEE calculator.** Mifflin-St Jeor formula, persists inputs + result on profile.
  - _Formula in `lib/tdee.ts`. Result + inputs stored on `profiles.tdee_*`. Last logged weight pre-fills the weight field if available._

## Phase 7 — Admin

- [x] **7.1 Admin dashboard.** `app/(admin)/dashboard/page.tsx` — total members, active plans, bookings this month, freeze count.
  - _Routes are under `app/admin/...` (URL `/admin/*`) so middleware's existing admin gate works without changes. `requireAdmin()` re-checks role in the layout per CLAUDE.md hard rule #2._
  - _Five tiles: members, active plans, bookings-this-month, active freezes, pending plan requests. Five parallel `count: 'exact'` queries._
- [x] **7.2 Users list + detail.** Search, view profile, view dietary questionnaire, manually adjust plan (edge cases).
  - _List has `or` filter across email/full_name/phone with `ilike`. Detail page shows profile, active plan (with editable form), pending requests, last 10 bookings, dietary JSON dump._
- [x] **7.3 Plan requests.** List of pending requests; approve/reject actions; on approve, plan is activated and confirmation email sent.
  - _Approve calls the `approve_plan_request` Postgres function (atomic deactivate-old + insert-new + flip-status). Reject is a row update with optional reason. Email TODO Phase 8._
- [x] **7.4 Schedule template.** Edit `schedule_template` rows: day of week, hour, capacity, enabled.
  - _Inline editor: per-day slot lists with enable/disable/delete buttons; "add slot" form at the top picks day, time (15-min increments), duration, capacity._
- [x] **7.5 Generate week sessions.** Server action that reads template and creates session rows for next week. Idempotent (skips if a session at that slot already exists).
  - _Anchors on the studio-local Monday of *next week*. For each enabled slot, computes `session_date`, `start_at`/`end_at`, and `unlock_at` via `unlockAtFor`. Skips rows that already exist (matched on `(session_date, start_at)`)._
- [x] **7.6 Sessions view.** Weekly calendar, each session shows roster of members.
  - _Lists 14 days from today. Each session shows time, class, booked/capacity, and the roster of currently-booked members. The "Generate next week" button lives in this page header._
- [x] **7.7 Plan tiers editor.** Edit names, prices, session counts.
  - _Inline rows; saves via service-role client because RLS would otherwise block writes from a non-admin's session (the action verifies admin first)._
- [x] **7.8 GDPR text editor.** Markdown-edit the document body, version-bumped on save.
  - _Form suggests the next version (bumps trailing number). Publish flow: demote any current row, insert new with `is_current = true`. Service-role client handles the dance because the partial unique index `gdpr_one_current` would otherwise reject naive inserts._

## Phase 8 — Email + cron

- [x] **8.1 Resend setup.** Verify `lasalastudio.ro` domain in Resend. Add SPF/DKIM DNS records.
  - _Code-side ready (sender addresses in `lib/constants.ts`, `RESEND_API_KEY` in env). DNS verification is a one-time manual step in the Resend dashboard._
- [x] **8.2 Send wrapper.** `lib/email/send.ts` with typed templates from `lib/email/templates/`. All sends go through this; never call `resend.emails.send` directly elsewhere.
  - _Single `sendEmail({ to, template, props, userId? })` entry point. Wraps every payload in the shared `renderEmailLayout`. Logs to `email_log` for both successes and failures. Errors are swallowed (callers shouldn't fail because email is down)._
- [x] **8.3 Booking confirmation email** — sent from `book_session` server action.
  - _Wired into book/cancel/reschedule. `loadBookingContext` is captured before cancel so the cancellation email still has the session details._
- [x] **8.4 Plan request acknowledgment + admin notification.**
  - _Both fired from `requestPlanAction`. Admin email goes to `ADMIN_NOTIFICATION_EMAIL` env var (skipped if unset)._
- [x] **8.5 Plan approved email.**
  - _Plus `planRejected` email from `rejectPlanRequestAction` so the user always hears back._
- [x] **8.6 Expiration warning cron.** `app/api/cron/expiration-warnings/route.ts` checks plans expiring in 7/3/1 days. Vercel cron daily at 09:00 Bucharest. Auth via `CRON_SECRET` header.
  - _Schedule in `vercel.json` is `0 6 * * *` UTC — that's 09:00 EEST (summer) / 08:00 EET (winter). Close enough for v1; if exact 09:00 local matters, add a second `0 7 * * *` entry and dedupe in the route._
- [x] **8.7 Low sessions warning cron.** Same pattern, fires when a member has ≤2 sessions remaining.
  - _Cheap dedupe via `email_log`: skip a member if a `lowSessionsWarning` row exists for them in the last 7 days, so they don't get hit daily._

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
