-- ================================================================
-- On-time renewals add up instead of waiting.
--
-- Studio rule (Sep 2026): when a member renews while the current plan is
-- still within its end_date, the new plan starts right away, the sessions
-- still unused on the current plan are added to the new plan's total, and
-- the new plan is valid until the current plan's end_date plus the tier's
-- duration. The member sees the sum immediately (e.g. 3 + 12 = 15). The
-- streak rule is unchanged: approval on/before end_date → streak + 1.
--
-- This replaces the "queued plan" mechanism from 0022 (activate when the
-- current one runs out). No queued row exists on the live project; the DO
-- block below still converts any that might, using the same merge rule.
-- plans.status is narrowed to 'active' | 'ended'.
--
-- Run after 0026_health_consent.sql.
-- ================================================================

begin;

-- ============ CONVERT ANY QUEUED ROWS (expected: none) ============

do $$
declare
  q public.plans;
  a public.plans;
  t public.plan_tiers;
  v_today date := public.studio_today();
begin
  for q in select * from public.plans where status = 'queued' loop
    select * into t from public.plan_tiers where id = q.tier_id;
    select * into a from public.plans where user_id = q.user_id and status = 'active';
    if a.id is not null then
      update public.plans set status = 'ended', is_active = false where id = a.id;
      update public.plans
        set status = 'active', is_active = true, activated_at = now(),
            start_date = v_today,
            end_date = (greatest(a.end_date, v_today)::timestamp
                          + (t.duration_months * interval '1 month'))::date,
            sessions_total = q.sessions_total
                             + greatest(a.sessions_total - a.sessions_used, 0)
        where id = q.id;
    else
      update public.plans
        set status = 'active', is_active = true, activated_at = now(),
            start_date = v_today,
            end_date = (v_today::timestamp
                          + (t.duration_months * interval '1 month')
                          - interval '1 day')::date
        where id = q.id;
    end if;
  end loop;
end $$;

drop function if exists public.activate_due_queued_plans();
drop function if exists public.activate_queued_plan(uuid, date);
drop index if exists public.plans_one_queued_per_user;

alter table public.plans drop constraint if exists plans_status_check;
alter table public.plans
  add constraint plans_status_check check (status in ('active', 'ended'));

-- ============ RESOLVE PLAN FOR A BOOKING ============
-- Kept as the single place the booking functions read the member's plan
-- (they lock the session first, then this); now simply the active plan.

create or replace function public.resolve_plan_for_booking(
  p_user_id uuid,
  p_session_date date
)
returns public.plans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active public.plans;
begin
  perform pg_advisory_xact_lock(hashtext('plan:' || p_user_id::text));
  select * into v_active
  from public.plans
  where user_id = p_user_id and status = 'active'
  for update;
  return v_active;
end;
$$;

revoke all on function public.resolve_plan_for_booking(uuid, date) from public;

-- ============ APPROVE PLAN REQUEST — merge on time, else fresh ============

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
  v_end date;
  v_total int;
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

  -- On time = approved (paid) no later than the current plan's end_date.
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

  v_total := v_tier.sessions_per_month * v_tier.duration_months;

  if v_on_time then
    -- Renewal: unused sessions carry over, validity extends from the
    -- current end_date, and the new plan is usable right now.
    v_total := v_total + greatest(v_active.sessions_total - v_active.sessions_used, 0);
    v_start := v_today;
    v_end := (v_active.end_date::timestamp
                + (v_tier.duration_months * interval '1 month'))::date;
  else
    v_start := coalesce(p_start_date, v_today);
    v_end := (v_start::timestamp
                + (v_tier.duration_months * interval '1 month')
                - interval '1 day')::date;
  end if;

  update public.plans
    set status = 'ended', is_active = false
    where user_id = v_request.user_id and status = 'active';

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, payment_method, is_active, status, activated_at,
    streak_month, discount_ron, price_paid_ron
  )
  values (
    v_request.user_id, v_tier.id, v_start, v_end,
    v_total, p_payment_method, true, 'active', now(),
    v_streak, v_discount, greatest(v_base - v_discount, 0)
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

commit;
