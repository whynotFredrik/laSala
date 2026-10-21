-- ================================================================
-- A frozen membership must not be booked.
--
-- Recurring pins are materialised through `book_session_for` (daily sync,
-- pin added, plan approved/activated). Nothing there looked at
-- `freeze_periods`, so a member who froze their plan kept being booked on
-- their pinned slots — and each booking spent a session while the plan's
-- end_date was being extended for the very same days.
--
--   * is_frozen_on(user, date): the one place that answers "is this
--     member frozen on this studio date".
--   * book_session_for: refuses a session date inside a freeze
--     ('Membership frozen on session date' -> skip reason `frozen`).
--   * freeze_membership: bookings already held inside the new freeze
--     window (typically pins booked for next week, since a freeze starts
--     at least 48h out) are cancelled through cancel_booking, so the
--     session is refunded and the spot freed. cancel_booking's trigger
--     records a recurring skip for each, which is harmless here.
--
-- Member self-booking (`book_session`) is unchanged.
-- Run after 0030_daily_agenda_recipients.sql.
-- ================================================================

begin;

-- ============ IS FROZEN ON ============

create or replace function public.is_frozen_on(p_user_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.freeze_periods f
    where f.user_id = p_user_id
      and p_date between f.start_date and f.end_date
  );
$$;

revoke all on function public.is_frozen_on(uuid, date) from public;

-- ============ BOOK SESSION FOR (admin / service) — freeze-aware ============

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
  v_session_date date;
begin
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

  v_session_date := (v_session.start_at at time zone 'Europe/Bucharest')::date;

  if public.is_frozen_on(p_user_id, v_session_date) then
    raise exception 'Membership frozen on session date' using errcode = 'P0001';
  end if;

  v_plan := public.resolve_plan_for_booking(p_user_id, v_session_date);
  if v_plan.id is null then
    raise exception 'No active plan' using errcode = 'P0001';
  end if;
  if v_plan.end_date < v_session_date then
    raise exception 'Plan expires before session date' using errcode = 'P0001';
  end if;
  if v_plan.sessions_used >= v_plan.sessions_total then
    raise exception 'No sessions remaining on plan' using errcode = 'P0001';
  end if;

  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = p_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date = v_session_date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  v_iso_week := to_char(v_session_date, 'IYYY-"W"IW');

  insert into public.bookings (user_id, session_id, status, iso_week)
  values (p_user_id, p_session_id, 'booked', v_iso_week)
  returning * into v_booking;

  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;
  update public.plans set sessions_used = sessions_used + 1 where id = v_plan.id;

  return v_booking;
end;
$$;

revoke all on function public.book_session_for(uuid, uuid) from public;
grant execute on function public.book_session_for(uuid, uuid) to authenticated;
grant execute on function public.book_session_for(uuid, uuid) to service_role;

-- ============ FREEZE MEMBERSHIP — cancel bookings inside the window ============

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
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_duration_days < 3 or p_duration_days > 14 then
    raise exception 'Duration must be 3-14 days' using errcode = 'P0001';
  end if;

  if p_start_date < (current_date + 2) then
    raise exception 'Freeze must start at least 48 hours from now' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans
    where user_id = v_user_id and status = 'active' for update;
  if not found then
    raise exception 'No active plan to freeze' using errcode = 'P0001';
  end if;

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

  update public.plans
    set end_date = end_date + p_duration_days
    where id = v_plan.id;

  for v_booking_id in
    select b.id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.user_id = v_user_id
      and b.status = 'booked'
      and (s.start_at at time zone 'Europe/Bucharest')::date
          between p_start_date and v_end_date
  loop
    perform public.cancel_booking(v_booking_id);
  end loop;

  return v_freeze;
end;
$$;

revoke all on function public.freeze_membership(date, int) from public;
grant execute on function public.freeze_membership(date, int) to authenticated;

commit;
