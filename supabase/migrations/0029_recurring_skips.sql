-- ================================================================
-- Recurring pins must not undo a one-off change.
--
-- Pins are materialised per (member, template slot): the daily sync books
-- every pinned session the member is not already booked into. When a
-- member (or an admin) moved this week's pinned booking to another slot,
-- or cancelled it, the next sync saw the original session free again and
-- re-booked it — the change for the current week was lost and the member
-- ended up back on (or doubled with) the recurring slot.
--
-- Fix: remember the concrete session a booking left. The pin skips those
-- (member, session) pairs; later weeks are untouched and keep following
-- the pin.
-- Run after 0028_streak_monthly_only.sql.
-- ================================================================

begin;

create table if not exists public.recurring_skips (
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.recurring_skips enable row level security;

drop policy if exists "admins read recurring skips" on public.recurring_skips;
create policy "admins read recurring skips"
  on public.recurring_skips for select
  using (public.is_admin());

-- Cancellation and reschedule both UPDATE the booking row in place
-- (status -> cancelled, or session_id -> new session), so one trigger
-- covers member and admin paths alike.
create or replace function public.record_recurring_skip()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status = 'booked'
     and (new.status <> 'booked' or new.session_id <> old.session_id) then
    insert into public.recurring_skips (user_id, session_id)
    values (old.user_id, old.session_id)
    on conflict do nothing;
  end if;
  -- Moving back onto a previously-left session clears its skip.
  if new.status = 'booked' then
    delete from public.recurring_skips
    where user_id = new.user_id and session_id = new.session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_record_recurring_skip on public.bookings;
create trigger bookings_record_recurring_skip
  after update of status, session_id on public.bookings
  for each row execute function public.record_recurring_skip();

commit;
