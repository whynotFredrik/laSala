-- ================================================================
-- Reconcile with what was applied to the live project outside the CLI
-- (branch claude/app-features-addition-50b8ef, Aug 2026): grace bookings
-- were removed (plans.grace_used dropped, bookings.is_grace kept as a
-- legacy refund guard), renewals gained a consistency streak with
-- discounts and the paid price recorded on the plan, early renewals were
-- queued via `plans.is_scheduled`, and `admin_grant_plan` enrolls
-- existing members.
--
-- 0022 introduced `plans.status` ('queued' | 'active' | 'ended') as the
-- single renewal mechanism. This migration makes the two worlds one:
--
--   * book_session / book_session_for: no grace path (it referenced the
--     dropped column) — an exhausted or expired plan with nothing queued
--     is rejected, as the August change intended.
--   * approve_plan_request: streak + discount + paid price restored on top
--     of the queued/active decision from 0022.
--   * admin_grant_plan / freeze_membership: status-aware, no is_scheduled.
--   * is_scheduled (+ its index/constraint) and
--     activate_due_scheduled_plans dropped — superseded by status='queued'
--     and activate_due_queued_plans. No row used is_scheduled.
--
-- The August schema itself is recorded as 0024–0026 (numbered after this
-- file because they were already applied when it was written); the
-- statements below are written so a fresh `db reset` works in file order:
-- plpgsql bodies are not validated against columns at creation time, and the
-- one plain-SQL statement touching is_scheduled is guarded.
--
-- Run after 0022_queued_plans.sql.
-- ================================================================

begin;

-- ============ SCHEMA: retire is_scheduled ============

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'plans'
      and column_name = 'is_scheduled'
  ) then
    update public.plans set status = 'queued', is_active = false
      where is_scheduled and status <> 'active';
  end if;
end $$;

drop index if exists public.plans_one_scheduled_per_user;
alter table public.plans drop constraint if exists plans_active_not_scheduled;
alter table public.plans drop column if exists is_scheduled;

drop function if exists public.activate_due_scheduled_plans();

-- ============ BOOK SESSION (member) — no grace ============

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
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if v_session.unlock_at > now() then
    raise exception 'Session not yet bookable' using errcode = 'P0001';
  end if;

  if v_session.booked_count >= v_session.capacity then
    raise exception 'Session is full' using errcode = 'P0001';
  end if;

  v_session_date := (v_session.start_at at time zone 'Europe/Bucharest')::date;

  -- Active plan if usable, else a queued one is activated on the spot.
  v_plan := public.resolve_plan_for_booking(v_user_id, v_session_date);
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
  where b.user_id = v_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date = v_session_date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  v_iso_week := to_char(v_session_date, 'IYYY-"W"IW');

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

-- ============ BOOK SESSION FOR (admin / service) — no grace ============

drop function if exists public.book_session_for(uuid, uuid, boolean);

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

-- ============ APPROVE PLAN REQUEST — queue/activate + streak ============
--
-- Streak (Aug 2026 rule): approval on or before the current plan's end_date
-- continues the streak (streak_month = old + 1), otherwise it resets to 1.
-- Monthly tiers get streak_discount_ron(streak) off the sex-based price;
-- 6-month promos get no discount but keep the counter. The price actually
-- charged is recorded on the plan.
--
-- Queue vs activate (0022 rule): if the current plan is still usable today
-- the new plan waits as 'queued' (activated when the current one is
-- exhausted or expires); otherwise it activates now, from p_start_date.

drop function if exists public.approve_plan_request(uuid, payment_method, date);

create or replace function public.approve_plan_request(
  p_request_id uuid,
  p_payment_method payment_method,
  p_start_date date default null
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
  v_active public.plans;
  v_plan public.plans;
  v_sex text;
  v_today date := public.studio_today();
  v_on_time boolean;
  v_streak int;
  v_base numeric;
  v_discount numeric;
  v_start date;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_request from public.plan_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request not found or not pending' using errcode = 'P0001';
  end if;

  select * into v_tier from public.plan_tiers where id = v_request.tier_id;

  perform pg_advisory_xact_lock(hashtext('plan:' || v_request.user_id::text));

  select * into v_active
  from public.plans
  where user_id = v_request.user_id and status = 'active'
  for update;

  if exists (
    select 1 from public.plans
    where user_id = v_request.user_id and status = 'queued'
  ) then
    raise exception 'A queued plan already exists' using errcode = 'P0001';
  end if;

  -- Streak: paid (approved) no later than the current plan's end_date.
  v_on_time := v_active.id is not null and v_today <= v_active.end_date;
  v_streak := case when v_on_time then v_active.streak_month + 1 else 1 end;

  select sex into v_sex from public.profiles where id = v_request.user_id;
  v_base := case
    when v_sex = 'female' then v_tier.price_female_ron
    else v_tier.price_male_ron
  end;
  v_discount := case
    when v_tier.category = 'monthly' then public.streak_discount_ron(v_streak)
    else 0
  end;

  if v_active.id is not null
     and v_active.end_date >= v_today
     and v_active.sessions_used < v_active.sessions_total
  then
    -- Current plan still usable → queue. Provisional dates, recomputed
    -- by activate_queued_plan.
    insert into public.plans (
      user_id, tier_id, start_date, end_date,
      sessions_total, payment_method, is_active, status,
      streak_month, discount_ron, price_paid_ron
    )
    values (
      v_request.user_id, v_tier.id, v_today,
      (v_today::timestamp
         + (v_tier.duration_months * interval '1 month')
         - interval '1 day')::date,
      v_tier.sessions_per_month * v_tier.duration_months,
      p_payment_method, false, 'queued',
      v_streak, v_discount, greatest(v_base - v_discount, 0)
    )
    returning * into v_plan;
  else
    v_start := coalesce(p_start_date, v_today);

    update public.plans
      set status = 'ended', is_active = false
      where user_id = v_request.user_id and status = 'active';

    insert into public.plans (
      user_id, tier_id, start_date, end_date,
      sessions_total, payment_method, is_active, status, activated_at,
      streak_month, discount_ron, price_paid_ron
    )
    values (
      v_request.user_id, v_tier.id, v_start,
      (v_start::timestamp
         + (v_tier.duration_months * interval '1 month')
         - interval '1 day')::date,
      v_tier.sessions_per_month * v_tier.duration_months,
      p_payment_method, true, 'active', now(),
      v_streak, v_discount, greatest(v_base - v_discount, 0)
    )
    returning * into v_plan;
  end if;

  update public.plan_requests
    set status = 'approved', approved_by = v_admin, approved_at = now()
    where id = p_request_id;

  return v_plan;
end;
$$;

revoke all on function public.approve_plan_request(uuid, payment_method, date) from public;
grant execute on function public.approve_plan_request(uuid, payment_method, date) to authenticated;

-- ============ ADMIN GRANT PLAN — status-aware ============

create or replace function public.admin_grant_plan(
  p_user_id uuid,
  p_tier_id uuid,
  p_start_date date default current_date,
  p_sessions_remaining int default null,
  p_streak_month int default 1
)
returns public.plans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier public.plan_tiers;
  v_total int;
  v_remaining int;
  v_plan public.plans;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select * into v_tier from public.plan_tiers where id = p_tier_id;
  if not found then
    raise exception 'Tier not found' using errcode = 'P0002';
  end if;

  v_total := v_tier.sessions_per_month * v_tier.duration_months;
  v_remaining := coalesce(p_sessions_remaining, v_total);
  if v_remaining < 0 or v_remaining > v_total then
    raise exception 'Sessions remaining out of range' using errcode = 'P0001';
  end if;

  if p_streak_month < 1 then
    raise exception 'Streak month must be >= 1' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('plan:' || p_user_id::text));

  -- Admin override: retire the current plan and any queued renewal.
  update public.plans
    set status = 'ended', is_active = false
    where user_id = p_user_id and status in ('active', 'queued');

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, sessions_used,
    is_active, status, activated_at, streak_month
  )
  values (
    p_user_id, v_tier.id, p_start_date,
    (p_start_date::timestamp
       + (v_tier.duration_months * interval '1 month')
       - interval '1 day')::date,
    v_total, v_total - v_remaining,
    true, 'active', now(), p_streak_month
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.admin_grant_plan(uuid, uuid, date, int, int) from public;
grant execute on function public.admin_grant_plan(uuid, uuid, date, int, int) to authenticated;

-- ============ FREEZE MEMBERSHIP — no is_scheduled ============
-- A queued plan's dates are provisional (recomputed at activation), so
-- there is nothing to shift when the active plan is extended.

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

  return v_freeze;
end;
$$;

revoke all on function public.freeze_membership(date, int) from public;
grant execute on function public.freeze_membership(date, int) to authenticated;

commit;
