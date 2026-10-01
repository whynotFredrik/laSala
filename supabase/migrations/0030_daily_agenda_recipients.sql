-- ================================================================
-- Daily agenda: addresses that get tomorrow's schedule by email every
-- evening (`/api/cron/daily-agenda`) — sessions, trainer, who is booked.
-- `trainer` narrows the email to one trainer's sessions; null = all.
-- Managed from the admin dashboard.
-- Run after 0029_recurring_skips.sql.
-- ================================================================

begin;

create table if not exists public.daily_agenda_recipients (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  trainer text check (trainer in ('Eugen', 'Marina', 'Ana')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists daily_agenda_recipients_email_key
  on public.daily_agenda_recipients (email);

alter table public.daily_agenda_recipients enable row level security;

drop policy if exists "admins manage agenda recipients"
  on public.daily_agenda_recipients;
create policy "admins manage agenda recipients"
  on public.daily_agenda_recipients for all
  using (public.is_admin())
  with check (public.is_admin());

commit;
