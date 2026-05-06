-- ================================================================
-- Booking, cancel, reschedule, freeze functions
-- All security definer; all enforce domain rules atomically.
-- Run after 0002_rls.sql.
-- ================================================================

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

  -- Active plan with remaining sessions and not expired
  select * into v_plan
  from public.plans
  where user_id = v_user_id and is_active
  for update;
  if not found then
    raise exception 'No active plan' using errcode = 'P0001';
  end if;
  if v_plan.end_date < (v_session.start_at at time zone 'Europe/Bucharest')::date then
    raise exception 'Plan expires before session date' using errcode = 'P0001';
  end if;
  if v_plan.sessions_used >= v_plan.sessions_total then
    raise exception 'No sessions remaining on plan' using errcode = 'P0001';
  end if;

  -- One booking per calendar date (in Bucharest time)
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date
        = (v_session.start_at at time zone 'Europe/Bucharest')::date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  -- ISO week of the session in Bucharest
  v_iso_week := to_char(
    (v_session.start_at at time zone 'Europe/Bucharest')::date,
    'IYYY-"W"IW'
  );

  -- Insert booking and bump counters
  insert into public.bookings (user_id, session_id, status, iso_week)
  values (v_user_id, p_session_id, 'booked', v_iso_week)
  returning * into v_booking;

  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;
  update public.plans set sessions_used = sessions_used + 1 where id = v_plan.id;

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

  -- Refund the session credit
  update public.plans
    set sessions_used = greatest(sessions_used - 1, 0)
    where user_id = v_booking.user_id and is_active;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;


-- ============ RESCHEDULE BOOKING ============

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

  -- Reschedule cap (2 per ISO week of the *current* booking)
  if v_booking.reschedule_count_iso_week >= 2 then
    raise exception 'Reschedule limit reached for this week' using errcode = 'P0001';
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
        reschedule_count_iso_week = reschedule_count_iso_week + 1
    where id = p_booking_id
    returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.reschedule_booking(uuid, uuid) from public;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;


-- ============ FREEZE MEMBERSHIP ============

create or replace function public.freeze_membership(p_start_date date, p_duration_days int)
returns public.freeze_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan public.plans;
  v_end_date date := p_start_date + (p_duration_days - 1);
  v_used_days int;
  v_freeze public.freeze_periods;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_duration_days < 3 or p_duration_days > 14 then
    raise exception 'Duration must be 3-14 days' using errcode = 'P0001';
  end if;

  -- 48-hour advance notice
  if p_start_date < (current_date + 2) then
    raise exception 'Freeze must start at least 48 hours from now' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans
    where user_id = v_user_id and is_active for update;
  if not found then
    raise exception 'No active plan to freeze' using errcode = 'P0001';
  end if;

  if v_end_date > v_plan.end_date + 14 then
    -- Sanity: can't freeze beyond what extension would cover
    null;
  end if;

  -- Rolling 6-month allowance: 14 days max in last 180 days + this freeze
  select coalesce(sum(duration_days), 0) into v_used_days
  from public.freeze_periods
  where user_id = v_user_id
    and start_date >= current_date - interval '180 days';

  if v_used_days + p_duration_days > 14 then
    raise exception 'Freeze allowance exceeded (14 days per 6 months)' using errcode = 'P0001';
  end if;

  insert into public.freeze_periods (user_id, plan_id, start_date, end_date)
  values (v_user_id, v_plan.id, p_start_date, v_end_date)
  returning * into v_freeze;

  -- Extend plan end date
  update public.plans
    set end_date = end_date + p_duration_days
    where id = v_plan.id;

  return v_freeze;
end;
$$;

revoke all on function public.freeze_membership(date, int) from public;
grant execute on function public.freeze_membership(date, int) to authenticated;


-- ============ APPROVE PLAN REQUEST (admin) ============

create or replace function public.approve_plan_request(
  p_request_id uuid,
  p_payment_method payment_method,
  p_start_date date default current_date
)
returns public.plans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.plan_requests;
  v_tier public.plan_tiers;
  v_plan public.plans;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_request from public.plan_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request not found or not pending' using errcode = 'P0001';
  end if;

  select * into v_tier from public.plan_tiers where id = v_request.tier_id;

  -- Deactivate any existing active plan for that user
  update public.plans set is_active = false
    where user_id = v_request.user_id and is_active;

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, payment_method, is_active
  )
  values (
    v_request.user_id, v_tier.id, p_start_date,
    p_start_date + (v_tier.duration_months * interval '1 month' - interval '1 day')::int,
    v_tier.sessions_per_month * v_tier.duration_months,
    p_payment_method, true
  )
  returning * into v_plan;

  update public.plan_requests
    set status = 'approved', approved_by = v_admin, approved_at = now()
    where id = p_request_id;

  return v_plan;
end;
$$;

revoke all on function public.approve_plan_request(uuid, payment_method, date) from public;
grant execute on function public.approve_plan_request(uuid, payment_method, date) to authenticated;
