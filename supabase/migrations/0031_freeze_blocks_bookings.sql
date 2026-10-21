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
--   * bookings trigger: no row may be 'booked' on a frozen date, whichever
--     function writes it — book_session (member), book_session_for (pins,
--     admin), reschedule_booking. Message 'Membership frozen on session
--     date' -> skip reason `frozen` / booking error `membership_frozen`.
--   * freeze_membership: bookings already held inside the new freeze
--     window (typically pins booked for next week, since a freeze starts
--     at least 48h out) are cancelled through cancel_booking, so the
--     session is refunded and the spot freed. cancel_booking's trigger
--     records a recurring skip for each, which is harmless here.
--
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

-- ============ NO ACTIVE BOOKING ON A FROZEN DAY ============
-- One guard for every path that creates or moves a booking: book_session
-- (member), book_session_for (pins, admin) and reschedule_booking all
-- INSERT or UPDATE a row with status 'booked'. Raising here aborts the
-- calling function's transaction, counters included.

create or replace function public.reject_frozen_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_date date;
begin
  select (s.start_at at time zone 'Europe/Bucharest')::date into v_session_date
  from public.sessions s where s.id = new.session_id;

  if public.is_frozen_on(new.user_id, v_session_date) then
    raise exception 'Membership frozen on session date' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_reject_frozen on public.bookings;
create trigger bookings_reject_frozen
  before insert or update of status, session_id on public.bookings
  for each row
  when (new.status = 'booked')
  execute function public.reject_frozen_booking();

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
