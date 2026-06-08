-- 0015_grace_bookings.sql
--
-- Grace bookings: members whose active plan has expired (sessions exhausted
-- OR end_date passed) can still book up to 2 more sessions while they sort
-- out renewal/payment. Those bookings:
--   - don't decrement `sessions_used` (the plan is already at its limit)
--   - draw from a separate `grace_used` counter on the plan (max 2)
--   - are flagged `is_grace = true` on the bookings row so cancel/reschedule
--     can refund the right counter
--
-- When a new plan is approved (existing logic in approve_plan_request
-- deactivates the old plan and inserts a new one), the new plan starts with
-- grace_used = 0 — every plan gets its own 2-booking grace budget that
-- activates when it expires.

begin;

-- ============ SCHEMA ============

alter table public.plans
  add column if not exists grace_used int not null default 0
  check (grace_used >= 0 and grace_used <= 2);

alter table public.bookings
  add column if not exists is_grace boolean not null default false;

-- ============ BOOK SESSION ============

create or replace function public.book_session(p_session_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.sessions;
  v_plan public.plans;
  v_iso_week text;
  v_existing_same_day uuid;
  v_booking public.bookings;
  v_session_date date;
  v_grace boolean := false;
  v_grace_cap constant int := 2;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Lock the session row to prevent concurrent overbooking
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- Unlock window
  if v_session.unlock_at > now() then
    raise exception 'Session not yet bookable' using errcode = 'P0001';
  end if;

  -- Capacity
  if v_session.booked_count >= v_session.capacity then
    raise exception 'Session is full' using errcode = 'P0001';
  end if;

  -- Active plan (existence required even for grace bookings — grace is a
  -- post-expiry favor, not a way to book without ever having a plan).
  select * into v_plan
  from public.plans
  where user_id = v_user_id and is_active
  for update;
  if not found then
    raise exception 'No active plan' using errcode = 'P0001';
  end if;

  v_session_date := (v_session.start_at at time zone 'Europe/Bucharest')::date;

  -- Decide whether this is a normal booking or a grace booking.
  if v_plan.end_date < v_session_date
     or v_plan.sessions_used >= v_plan.sessions_total
  then
    if v_plan.grace_used >= v_grace_cap then
      raise exception 'Grace bookings exhausted, please renew plan'
        using errcode = 'P0001';
    end if;
    v_grace := true;
  end if;

  -- One booking per calendar date (in Bucharest time)
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date = v_session_date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  -- ISO week of the session in Bucharest
  v_iso_week := to_char(v_session_date, 'IYYY-"W"IW');

  -- Insert booking and bump counters
  insert into public.bookings (user_id, session_id, status, iso_week, is_grace)
  values (v_user_id, p_session_id, 'booked', v_iso_week, v_grace)
  returning * into v_booking;

  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;

  if v_grace then
    update public.plans set grace_used = grace_used + 1 where id = v_plan.id;
  else
    update public.plans set sessions_used = sessions_used + 1 where id = v_plan.id;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.book_session(uuid) from public;
grant execute on function public.book_session(uuid) to authenticated;

-- ============ CANCEL BOOKING ============

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

  -- 3-hour window (admins can cancel anytime)
  if not v_is_admin and v_session.start_at - now() < interval '3 hours' then
    raise exception 'Cannot cancel within 3 hours of session' using errcode = 'P0001';
  end if;

  update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id
    returning * into v_booking;

  update public.sessions set booked_count = booked_count - 1 where id = v_session.id;

  -- Refund the appropriate counter: grace bookings refund grace_used,
  -- normal bookings refund sessions_used.
  if v_booking.is_grace then
    update public.plans
      set grace_used = greatest(grace_used - 1, 0)
      where user_id = v_booking.user_id and is_active;
  else
    update public.plans
      set sessions_used = greatest(sessions_used - 1, 0)
      where user_id = v_booking.user_id and is_active;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;

commit;
