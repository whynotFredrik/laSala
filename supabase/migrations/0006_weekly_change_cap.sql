-- ================================================================
-- Unified weekly change cap: 2 cancellations + reschedules per ISO week,
-- per user. Replaces the previous per-booking reschedule cap.
-- Run after 0005_admin_features.sql.
-- ================================================================

-- Add a `rescheduled_at` timestamp so we can count reschedules in a week
-- the same way we count cancellations (via `cancelled_at`).
alter table public.bookings
  add column if not exists rescheduled_at timestamptz;

-- Helper: count of "changes" (cancellations + reschedules) for a given
-- user in the current ISO week, in studio local time.
create or replace function public.weekly_change_count(p_user_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_local_now timestamp;
  v_week_start_local timestamp;
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_count int;
begin
  -- Anchor to the start of the ISO week in Europe/Bucharest, then convert
  -- back to UTC for the timestamp comparisons against cancelled_at /
  -- rescheduled_at.
  v_local_now := (now() at time zone 'Europe/Bucharest');
  v_week_start_local := date_trunc('week', v_local_now);
  v_week_start := v_week_start_local at time zone 'Europe/Bucharest';
  v_week_end := v_week_start + interval '7 days';

  select count(*) into v_count
  from public.bookings
  where user_id = p_user_id
    and (
      (cancelled_at is not null
        and cancelled_at >= v_week_start
        and cancelled_at < v_week_end)
      or (rescheduled_at is not null
        and rescheduled_at >= v_week_start
        and rescheduled_at < v_week_end)
    );
  return v_count;
end;
$$;

grant execute on function public.weekly_change_count(uuid) to authenticated;

-- ============ CANCEL_BOOKING — enforce weekly cap ============

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_booking public.bookings;
  v_session public.sessions;
  v_change_count int;
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

  select * into v_session from public.sessions where id = v_booking.session_id for update;

  -- 3-hour window (admins bypass).
  if not v_is_admin and v_session.start_at - now() < interval '3 hours' then
    raise exception 'Cannot cancel within 3 hours of session' using errcode = 'P0001';
  end if;

  -- Weekly change cap (admins bypass). Counts both cancels and reschedules.
  if not v_is_admin then
    v_change_count := public.weekly_change_count(v_booking.user_id);
    if v_change_count >= 2 then
      raise exception 'Weekly change limit reached' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  update public.sessions set booked_count = booked_count - 1 where id = v_session.id;

  -- Refund the session credit on the user's active plan.
  update public.plans
    set sessions_used = greatest(sessions_used - 1, 0)
    where user_id = v_booking.user_id and is_active;

  return v_booking;
end;
$$;

-- ============ RESCHEDULE_BOOKING — enforce weekly cap + record timestamp ============

create or replace function public.reschedule_booking(p_booking_id uuid, p_new_session_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_old_session public.sessions;
  v_new_session public.sessions;
  v_existing_same_day uuid;
  v_new_iso_week text;
  v_change_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.user_id <> v_user_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'Booking not active' using errcode = 'P0001';
  end if;

  -- Unified weekly cap: 2 changes (cancels + reschedules) per ISO week.
  v_change_count := public.weekly_change_count(v_user_id);
  if v_change_count >= 2 then
    raise exception 'Weekly change limit reached' using errcode = 'P0001';
  end if;

  select * into v_old_session from public.sessions where id = v_booking.session_id for update;
  select * into v_new_session from public.sessions where id = p_new_session_id for update;
  if not found then
    raise exception 'New session not found' using errcode = 'P0002';
  end if;

  if v_new_session.unlock_at > now() then
    raise exception 'New session not yet bookable' using errcode = 'P0001';
  end if;
  if v_new_session.booked_count >= v_new_session.capacity then
    raise exception 'New session is full' using errcode = 'P0001';
  end if;
  if v_old_session.start_at - now() < interval '3 hours' then
    raise exception 'Cannot reschedule within 3 hours of original session' using errcode = 'P0001';
  end if;

  -- Same-day check excluding the current booking
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_user_id
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

  -- Move counters
  update public.sessions set booked_count = booked_count - 1 where id = v_old_session.id;
  update public.sessions set booked_count = booked_count + 1 where id = v_new_session.id;

  update public.bookings
    set session_id = p_new_session_id,
        iso_week = v_new_iso_week,
        reschedule_count_iso_week = reschedule_count_iso_week + 1,
        rescheduled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  return v_booking;
end;
$$;
