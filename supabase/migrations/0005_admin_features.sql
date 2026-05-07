-- ================================================================
-- Phase: trainer-aware sessions, sex-based pricing, meal plans.
-- Run after 0004_signup_fields.sql.
-- ================================================================

-- ============ TRAINER ON SCHEDULE & SESSIONS ============
-- Each schedule slot belongs to a specific trainer; multiple slots can
-- now share a (day, time) — one per trainer running in parallel. The
-- book page filters to the member's assigned trainer.

alter table public.schedule_template
  add column if not exists trainer text
    check (trainer in ('Eugen', 'Marina', 'Ana'));

alter table public.sessions
  add column if not exists trainer text
    check (trainer in ('Eugen', 'Marina', 'Ana'));

-- Replace the old (day, hour, minute) uniqueness with a per-trainer one
-- so we can have parallel slots.
drop index if exists schedule_template_slot_unique;
create unique index schedule_template_slot_unique
  on public.schedule_template (day_of_week, start_hour, start_minute, trainer)
  where is_enabled;

drop index if exists sessions_unique_slot;
create unique index sessions_unique_slot
  on public.sessions (session_date, start_at, trainer);

create index if not exists sessions_trainer_idx on public.sessions (trainer);

-- ============ SEX-BASED PRICING ============
-- Add male/female price columns; backfill from the legacy `price_ron`,
-- then drop it so admin always sees the explicit two-price form.

alter table public.plan_tiers
  add column if not exists price_male_ron numeric(10,2),
  add column if not exists price_female_ron numeric(10,2);

update public.plan_tiers
set
  price_male_ron = coalesce(price_male_ron, price_ron),
  price_female_ron = coalesce(price_female_ron, price_ron);

alter table public.plan_tiers
  alter column price_male_ron set not null,
  alter column price_female_ron set not null;

-- Keep the legacy column for one cycle so any in-flight code path doesn't
-- crash; it's no longer the source of truth. Drop in a future migration
-- once we're confident nothing reads it.
alter table public.plan_tiers
  alter column price_ron drop not null;

-- ============ MEAL PLANS ============
-- One row per meal plan version. We keep history (no in-place edit) so
-- the member can scroll back to previous plans.

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body_md text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meal_plans_user_idx
  on public.meal_plans (user_id, created_at desc);

alter table public.meal_plans enable row level security;

drop policy if exists "users read own meal plans" on public.meal_plans;
create policy "users read own meal plans"
  on public.meal_plans for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage meal plans" on public.meal_plans;
create policy "admins manage meal plans"
  on public.meal_plans for all
  using (public.is_admin())
  with check (public.is_admin());
