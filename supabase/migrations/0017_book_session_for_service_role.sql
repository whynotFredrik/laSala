-- ================================================================
-- Fix: recurring auto-booking silently skipped every member.
--
-- The week generator (admin button + /api/cron/generate-week) calls
-- `book_session_for` through the service-role client. In that context
-- `auth.uid()` is NULL, so `public.is_admin()` returns false and the
-- function raised 'Admin only' for every recurring member. On top of
-- that, EXECUTE was only granted to `authenticated`, so `service_role`
-- could not even call it. Both failures were swallowed by the generator
-- and reported as "recurringSkipped".
--
-- This migration lets a service-role caller (server-only, never exposed to
-- the browser) use the function, while keeping the admin gate for
-- authenticated callers. Run after 0016_admin_reschedule.sql.
-- ================================================================

create or replace function public.book_session_for(
  p_user_id uuid,
  p_session_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.sessions;
  v_plan public.plans;
  v_iso_week text;
  v_existing_same_day uuid;
  v_booking public.bookings;
begin
  -- Allowed callers: an authenticated admin, or the service-role key
  -- (used by the week generator / cron, which runs with no auth.uid()).
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if v_session.booked_count >= v_session.capacity then
    raise exception 'Session is full' using errcode = 'P0001';
  end if;

  select * into v_plan
  from public.plans
  where user_id = p_user_id and is_active
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

  -- Same-day check (admin still respects "one booking per calendar date").
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = p_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date
        = (v_session.start_at at time zone 'Europe/Bucharest')::date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  v_iso_week := to_char(
    (v_session.start_at at time zone 'Europe/Bucharest')::date,
    'IYYY-"W"IW'
  );

  insert into public.bookings (user_id, session_id, status, iso_week)
  values (p_user_id, p_session_id, 'booked', v_iso_week)
  returning * into v_booking;

  update public.sessions
    set booked_count = booked_count + 1
    where id = p_session_id;
  update public.plans
    set sessions_used = sessions_used + 1
    where id = v_plan.id;

  return v_booking;
end;
$$;

revoke all on function public.book_session_for(uuid, uuid) from public;
grant execute on function public.book_session_for(uuid, uuid) to authenticated;
grant execute on function public.book_session_for(uuid, uuid) to service_role;
