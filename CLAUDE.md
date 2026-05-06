# Project instructions for Claude Code

This file is the contract between you (Claude Code) and the project. Read it at the start of every session before writing code.

## What this project is

A booking and membership app for **Lasala Fitness Studio**, a small gym in Oradea, Romania. Real users will be the studio's members. Code quality matters; this is not a prototype.

## Stack and conventions

- **Next.js 15 App Router**, React Server Components by default. Add `'use client'` only where needed (event handlers, hooks, interactivity).
- **TypeScript strict.** No `any` unless justified in a comment. Prefer `unknown` and narrow.
- **Tailwind CSS** for styling, **shadcn/ui** for primitives. No separate CSS files unless unavoidable.
- **Supabase** for database, auth, storage. Use `@supabase/ssr` for the Next.js integration. Maintain three client factories in `lib/supabase/`: `server.ts`, `browser.ts`, `service.ts` (service-role, server-only).
- **Server Actions** for mutations from the member-facing UI. **Route handlers** (`app/api/.../route.ts`) for webhooks, cron, and any endpoint a third party calls.
- **next-intl** for i18n. All user-facing strings come from `messages/ro.json`. Never hardcode Romanian text in components.
- **Zod** for input validation at every trust boundary (Server Actions, route handlers).
- **Resend** for email. Templates live in `lib/email/templates/`, senders in `lib/email/send.ts`.
- **pnpm** as the package manager.

## Hard rules

These are non-negotiable. If a task seems to require breaking one, stop and surface it.

1. **Never store image data in the database.** Photos go to Supabase Storage, the DB stores the storage path.
2. **Never trust client-supplied user IDs or roles.** Always derive the user from `supabase.auth.getUser()` server-side. Always re-check role for admin operations server-side, even if middleware already gated the route.
3. **Every table has Row Level Security enabled.** No exceptions. If you add a table, add RLS policies in the same migration.
4. **Never call the service-role key from a Client Component or expose it to the browser.** It belongs in route handlers and server-only utilities.
5. **Booking creation, cancellation, and rescheduling go through the Postgres function `book_session`, `cancel_booking`, `reschedule_booking`.** Do not implement those operations as separate `INSERT`/`UPDATE` calls from the application — they are race-prone. The functions are in `supabase/migrations/`.
6. **Never commit secrets.** `.env.local` is gitignored. Document required env vars in `.env.example`.
7. **No `any`-typed Supabase responses.** Generate and use the database types: `pnpm supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts`.

## Domain rules — read before touching booking logic

The studio's actual booking rules. These are encoded in Postgres functions and in `lib/booking/rules.ts`. If you change one, change it in both places and update the test.

- **Sunday unlock:** sessions for week N+1 become bookable at `Europe/Bucharest` midnight on Sunday of week N. A session for Monday Oct 7 is bookable from Sunday Sep 29 00:00 Bucharest time onward.
- **One booking per day per member.** Enforced via unique partial index `(user_id, session_date) where status = 'booked'`.
- **Plan required and not expired.** `sessions_used < plan_total` AND `plan.end_date >= today`.
- **Cancellation:** allowed up to 3 hours before `session.start_at`. Within 3 hours, the booking is locked.
- **Reschedule:** counts increment in `bookings.reschedule_count_in_week`; cap is 2 per ISO week.
- **Freeze:** member submits a freeze request with `start_date` (must be ≥48h from now) and `duration_days` (3–14). Freezing extends `plan.end_date` by `duration_days`. Total frozen days in any rolling 6-month window may not exceed 14.

## Code style

- **Imports:** absolute paths via `@/` alias.
- **Component files:** one component per file, default export, file name = component name.
- **Server Actions:** colocate next to the page they serve as `actions.ts`, marked `'use server'` at file top.
- **Errors:** throw `Error` subclasses; let Next.js error boundaries catch them. Never `console.log` in committed code — use a logger or remove it.
- **Forms:** react-hook-form + zod resolver, server-side validation always re-runs the same Zod schema.
- **Dates:** store as `timestamptz` in Postgres. Work in `Europe/Bucharest` for any user-facing display or rule (Sunday-unlock, cancellation window). `date-fns-tz` for tz math.

## Testing approach

- **Unit tests** for `lib/booking/rules.ts` (pure functions). Vitest.
- **Integration tests** for the Postgres functions using a test Supabase instance — at minimum, prove the booking function handles concurrent attempts on the last spot.
- **Playwright** for one happy-path member flow (login → book → see in history) and one admin flow (approve plan → user sees active plan). Skip exhaustive E2E.

## What this app is replacing

A previous AI-generated version (Expo + FastAPI + MongoDB) had several issues we are deliberately fixing:

- SHA256 password hashing (now: Supabase Auth, bcrypt under the hood)
- Race conditions on booking capacity (now: Postgres function with row locks)
- Base64 photos in MongoDB (now: Supabase Storage with RLS)
- 2,900-line monolithic backend file (now: route handlers, server actions, lib modules)
- Mongo for inherently relational data (now: Postgres)

If you find yourself reaching for a pattern that resembles those, stop and ask.

## What "done" looks like for v1

The list in `TASKS.md`. Work through it in order. Mark each task as you finish, with a one-line note on anything non-obvious you did or skipped.

## When to ask vs decide

- **Decide:** naming, file layout, which shadcn component to use, Tailwind class choices, internal function structure.
- **Ask:** anything that changes a domain rule, anything that touches secrets or auth flow, anything where the project README and this file disagree, anything where the request seems to require breaking a Hard Rule above.
