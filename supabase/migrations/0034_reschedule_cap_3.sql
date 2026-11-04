-- ================================================================
-- Reschedule cap: 3 per member per studio week (was 2).
--
-- The studio asked for one more move per week. While here, the cap is
-- made what members are told it is — "N reschedules per week" — instead
-- of a per-booking counter: the live project still ran the 0006 body
-- (cancellations + reschedules counted together, no admin bypass) because
-- 0016 never reached it, while the repo had the per-booking 0016 one.
--
-- This is the single definitive reschedule_booking:
--   * members: at most 3 reschedules made in the current ISO week
--     (Mon–Sun, Europe/Bucharest). Every move is logged in
--     `reschedule_events`, so moving the same booking twice counts twice
--     (a per-booking `rescheduled_at` only remembers the last move).
--     Cancellations do not count. Admins bypass the cap, ownership, unlock
--     and the 3-hour lock (same as 0016); their moves are logged too but
--     never block the member.
--   * every move also stamps `bookings.rescheduled_at` and bumps
--     `reschedule_count_iso_week` (kept for reporting).
--   * frozen-day and recurring-skip triggers on bookings (0029, 0032)
--     still apply unchanged.
--
-- Keep RESCHEDULE_PER_WEEK_CAP in lib/booking/rules.ts in sync.
-- Run after 0033_admin_freezes.sql.
-- ================================================================

begin;

-- ============ RESCHEDULE LOG ============

create table if not exists public.reschedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_session_id uuid references public.sessions(id) on delete set null,
  to_session_id uuid references public.sessions(id) on delete set null,
  by_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reschedule_events_user_created_idx
  on public.reschedule_events (user_id, created_at);

alter table public.reschedule_events enable row level security;

drop policy if exists "members read own reschedule events" on public.reschedule_events;
create policy "members read own reschedule events"
  on public.reschedule_events for select
  using (user_id = auth.uid());

drop policy if exists "admins read reschedule events" on public.reschedule_events;
create policy "admins read reschedule events"
  on public.reschedule_events for select
  using (public.is_admin());

-- Writes only through reschedule_booking (security definer): no
-- insert/update/delete policy.

-- ============ WEEKLY COUNT ============

create or replace function public.weekly_reschedule_count(p_user_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.reschedule_events
  where user_id = p_user_id
    and not by_admin
    and created_at >= (date_trunc('week', now() at time zone 'Europe/Bucharest')
                       at time zone 'Europe/Bucharest')
    and created_at < ((date_trunc('week', now() at time zone 'Europe/Bucharest')
                       + interval '7 days') at time zone 'Europe/Bucharest');
$$;

revoke all on function public.weekly_reschedule_count(uuid) from public, anon;
grant execute on function public.weekly_reschedule_count(uuid) to authenticated;

create or replace function public.reschedule_booking(p_booking_id uuid, p_new_session_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_cap constant int := 3;
  v_booking public.bookings;
  v_old_session public.sessions;
  v_new_session public.sessions;
  v_existing_same_day uuid;
  v_new_iso_week text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.user_id <> v_user_id and not v_is_admin then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'Booking not active' using errcode = 'P0001';
  end if;

  -- Weekly reschedule cap (members only; admins bypass).
  if not v_is_admin and public.weekly_reschedule_count(v_booking.user_id) >= v_cap then
    raise exception 'Reschedule limit reached for this week' using errcode = 'P0001';
  end if;

  select * into v_old_session from public.sessions where id = v_booking.session_id for update;
  select * into v_new_session from public.sessions where id = p_new_session_id for update;
  if not found then
    raise exception 'New session not found' using errcode = 'P0002';
  end if;

  if not v_is_admin and v_new_session.unlock_at > now() then
    raise exception 'New session not yet bookable' using errcode = 'P0001';
  end if;
  if v_new_session.booked_count >= v_new_session.capacity then
    raise exception 'New session is full' using errcode = 'P0001';
  end if;

  -- 3-hour pre-session window (members only; admins bypass).
  if not v_is_admin and v_old_session.start_at - now() < interval '3 hours' then
    raise exception 'Cannot reschedule within 3 hours of original session' using errcode = 'P0001';
  end if;

  -- One booking per day, excluding the booking being moved.
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_booking.user_id
    and b.status = 'booked'
    and b.id <> p_booking_id
    and (s.start_at at time zone 'Europe/Bucharest')::date
        = (v_new_session.start_at at time zone 'Europe/Bucharest')::date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for the new date' using errcode = 'P0001';
  end if;

  v_new_iso_week := to_char(
    (v_new_session.start_at at time zone 'Europe/Bucharest')::date,
    'IYYY-"W"IW'
  );

  update public.sessions set booked_count = booked_count - 1 where id = v_old_session.id;
  update public.sessions set booked_count = booked_count + 1 where id = v_new_session.id;

  update public.bookings
    set session_id = p_new_session_id,
        iso_week = v_new_iso_week,
        reschedule_count_iso_week = reschedule_count_iso_week + 1,
        rescheduled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  insert into public.reschedule_events
    (user_id, booking_id, from_session_id, to_session_id, by_admin)
  values
    (v_booking.user_id, v_booking.id, v_old_session.id, v_new_session.id,
     v_is_admin and v_booking.user_id <> v_user_id);

  return v_booking;
end;
$$;

revoke all on function public.reschedule_booking(uuid, uuid) from public, anon;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;

commit;
