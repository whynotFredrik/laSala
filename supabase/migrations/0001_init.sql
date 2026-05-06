-- ================================================================
-- Lasala Fitness Studio - initial schema
-- Run in Supabase SQL editor as a single transaction.
-- ================================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============ ENUMS ============

create type user_role as enum ('member', 'admin');
create type plan_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type payment_method as enum ('bank_transfer', 'pos', 'cash');
create type booking_status as enum ('booked', 'cancelled', 'completed', 'no_show');

-- ============ PROFILES ============
-- One row per Supabase auth user, created by trigger on auth.users insert.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role user_role not null default 'member',
  locale text not null default 'ro' check (locale in ('ro', 'en')),
  gdpr_consented_at timestamptz,
  gdpr_version text,
  -- TDEE inputs (nullable until member fills them in)
  tdee_age int,
  tdee_sex text check (tdee_sex in ('male', 'female')),
  tdee_height_cm numeric(5,1),
  tdee_activity text check (tdee_activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  tdee_value int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PLAN TIERS ============
-- The set of plans offered. Editable by admins.

create table public.plan_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- '8', '12', '16', '20', '6m_8', etc.
  name_ro text not null,
  name_en text,
  category text not null check (category in ('monthly', 'promo_6m')),
  sessions_per_month int not null check (sessions_per_month > 0),
  duration_months int not null default 1 check (duration_months >= 1),
  price_ron numeric(10,2) not null check (price_ron >= 0),
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ PLANS (active member subscriptions) ============

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid not null references public.plan_tiers(id),
  start_date date not null,
  end_date date not null,
  sessions_total int not null check (sessions_total > 0),
  sessions_used int not null default 0 check (sessions_used >= 0),
  payment_method payment_method,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (sessions_used <= sessions_total),
  check (end_date >= start_date)
);

-- A member can have at most one active plan
create unique index plans_one_active_per_user on public.plans (user_id) where is_active;
create index plans_user_idx on public.plans (user_id);
create index plans_end_date_idx on public.plans (end_date) where is_active;

-- ============ PLAN REQUESTS ============
-- Member requests plan; admin approves after offline payment.

create table public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid not null references public.plan_tiers(id),
  status plan_request_status not null default 'pending',
  preferred_payment_method payment_method,
  notes text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- A user can have at most one pending request at a time
create unique index plan_requests_one_pending_per_user
  on public.plan_requests (user_id) where status = 'pending';
create index plan_requests_status_idx on public.plan_requests (status);

-- ============ FREEZE PERIODS ============

create table public.freeze_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  duration_days int generated always as (end_date - start_date + 1) stored,
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check ((end_date - start_date + 1) between 3 and 14)
);

-- No overlapping freezes for the same user
create index freeze_periods_user_idx on public.freeze_periods (user_id, start_date);
alter table public.freeze_periods
  add constraint freeze_no_overlap
  exclude using gist (user_id with =, daterange(start_date, end_date, '[]') with &&);

-- ============ CLASSES ============
-- Class types (e.g. "The Class", "HIIT").

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name_ro text not null,
  name_en text,
  description_ro text,
  description_en text,
  default_duration_min int not null default 60,
  color text default '#EF4444',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ SCHEDULE TEMPLATE ============
-- The recurring weekly schedule from which sessions are generated.

create table public.schedule_template (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),  -- 0=Mon ... 6=Sun
  start_hour int not null check (start_hour between 0 and 23),
  start_minute int not null default 0 check (start_minute in (0, 15, 30, 45)),
  duration_min int not null default 60,
  capacity int not null default 6 check (capacity > 0),
  class_id uuid references public.classes(id),
  is_enabled boolean not null default true
);

create unique index schedule_template_slot_unique
  on public.schedule_template (day_of_week, start_hour, start_minute) where is_enabled;

-- ============ SESSIONS ============
-- Concrete instances generated from the template.

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id),
  session_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity int not null check (capacity > 0),
  booked_count int not null default 0 check (booked_count >= 0),
  unlock_at timestamptz not null,    -- becomes bookable at this moment (Sunday 00:00 Europe/Bucharest of prior week)
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  check (booked_count <= capacity)
);

create unique index sessions_unique_slot on public.sessions (session_date, start_at);
create index sessions_date_idx on public.sessions (session_date);
create index sessions_unlock_idx on public.sessions (unlock_at);

-- ============ BOOKINGS ============

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete restrict,
  status booking_status not null default 'booked',
  reschedule_count_iso_week int not null default 0,
  iso_week text not null,             -- 'YYYY-Www' for the booking week, used in reschedule cap
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  notes text
);

-- One active booking per user per session
create unique index bookings_user_session_active
  on public.bookings (user_id, session_id) where status = 'booked';

-- One active booking per user per calendar date (computed via session join in the booking RPC)
create index bookings_user_status_idx on public.bookings (user_id, status);
create index bookings_session_idx on public.bookings (session_id);

-- ============ PROGRESS TRACKING ============

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5,2) not null check (weight_kg > 0),
  note text,
  created_at timestamptz not null default now()
);
create unique index weight_logs_user_date on public.weight_logs (user_id, logged_on);

create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  logged_on date not null,
  calories int check (calories >= 0),
  protein_g numeric(5,1) check (protein_g >= 0),
  carbs_g numeric(5,1) check (carbs_g >= 0),
  fat_g numeric(5,1) check (fat_g >= 0),
  note text,
  created_at timestamptz not null default now()
);
create unique index nutrition_logs_user_date on public.nutrition_logs (user_id, logged_on);

-- Photos: only the storage path, never the binary
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  taken_on date not null,
  front_path text,
  side_path text,
  back_path text,
  weight_kg numeric(5,2),
  note text,
  created_at timestamptz not null default now()
);
create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

-- ============ DIETARY QUESTIONNAIRE ============

create table public.dietary_questionnaires (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Intolerances
  gluten_intolerance boolean not null default false,
  lactose_intolerance boolean not null default false,
  nut_allergy boolean not null default false,
  egg_allergy boolean not null default false,
  soy_allergy boolean not null default false,
  shellfish_allergy boolean not null default false,
  fish_allergy boolean not null default false,
  -- Excluded foods
  exclude_pork boolean not null default false,
  exclude_beef boolean not null default false,
  exclude_poultry boolean not null default false,
  exclude_seafood boolean not null default false,
  exclude_dairy boolean not null default false,
  exclude_eggs boolean not null default false,
  exclude_gluten boolean not null default false,
  exclude_soy boolean not null default false,
  exclude_nuts boolean not null default false,
  exclude_alcohol boolean not null default false,
  exclude_caffeine boolean not null default false,
  exclude_sugar boolean not null default false,
  exclude_processed_foods boolean not null default false,
  -- Diet preferences
  vegetarian boolean not null default false,
  vegan boolean not null default false,
  pescatarian boolean not null default false,
  keto boolean not null default false,
  paleo boolean not null default false,
  low_carb boolean not null default false,
  low_fat boolean not null default false,
  high_protein boolean not null default false,
  additional_notes text,
  updated_at timestamptz not null default now()
);

-- ============ GDPR DOCUMENT ============

create table public.gdpr_document (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  body_md text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index gdpr_one_current on public.gdpr_document (is_current) where is_current;

-- ============ NOTIFICATIONS LOG ============
-- Audit trail of emails sent, useful for support and idempotency.

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  template text not null,
  to_email text not null,
  subject text not null,
  resend_id text,
  status text not null default 'sent',
  error text,
  created_at timestamptz not null default now()
);
create index email_log_user_idx on public.email_log (user_id, created_at desc);

-- ============ UPDATED_AT TRIGGER ============

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger dietary_questionnaires_updated_at before update on public.dietary_questionnaires
  for each row execute function public.set_updated_at();
