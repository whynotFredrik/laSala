-- 0018_renewal_streak.sql
--
-- Consistency streak ("Streak de consecvență"): pay the next plan before the
-- current one expires and unlock progressive discounts.
--
--   * Every plan carries `streak_month` (1 = first month, standard price).
--   * Payment happens in person and is recorded the moment an admin approves
--     the plan request, so "paid before expiry" means: approval happens no
--     later than the current plan's end_date (Bucharest calendar date).
--     On-time approval → new plan gets streak_month = old + 1; otherwise 1.
--   * Discount off the sex-based tier price, monthly tiers only:
--       month 2 → 15 RON, month 3 → 30 RON, month 4+ → 40 RON (veteran).
--     6-month promo tiers get no discount (their discount is baked into the
--     package price) but an on-time promo renewal still advances the counter
--     so it doesn't break the chain.
--   * Early renewals no longer destroy the remaining days of the current
--     plan: the new plan is inserted with `is_scheduled = true` and
--     start_date = old end_date + 1. The daily cron
--     `/api/cron/activate-scheduled-plans` calls
--     `activate_due_scheduled_plans()` to flip it to active on that day.
--   * The price actually charged is recorded on the plan row
--     (`price_paid_ron`, `discount_ron`) — until now no price was persisted.
--   * `freeze_membership` shifts a scheduled plan together with the frozen
--     plan's end_date so the two stay contiguous.
--
-- Mirror of the discount table lives in lib/plans/streak.ts — keep in sync.
-- Run after 0017_remove_grace.sql.

begin;

-- ============ SCHEMA ============

alter table public.plans
  add column if not exists streak_month int not null default 1
    check (streak_month >= 1),
  add column if not exists discount_ron numeric(10,2) not null default 0
    check (discount_ron >= 0),
  add column if not exists price_paid_ron numeric(10,2),
  add column if not exists is_scheduled boolean not null default false;

alter table public.plans
  add constraint plans_active_not_scheduled check (not (is_active and is_scheduled));

-- At most one queued renewal per member.
create unique index if not exists plans_one_scheduled_per_user
  on public.plans (user_id) where is_scheduled;

-- ============ DISCOUNT TABLE ============

create or replace function public.streak_discount_ron(p_streak_month int)
returns numeric
language sql
immutable
as $$
  select case
    when p_streak_month >= 4 then 40
    when p_streak_month = 3 then 30
    when p_streak_month = 2 then 15
    else 0
  end::numeric;
$$;

revoke all on function public.streak_discount_ron(int) from public;
grant execute on function public.streak_discount_ron(int) to authenticated;

-- ============ APPROVE PLAN REQUEST ============

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
  v_old public.plans;
  v_has_old boolean;
  v_plan public.plans;
  v_sex text;
  v_today date := (now() at time zone 'Europe/Bucharest')::date;
  v_on_time boolean;
  v_streak int;
  v_base numeric;
  v_discount numeric;
  v_start date;
  v_scheduled boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_request from public.plan_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Request not found or not pending' using errcode = 'P0001';
  end if;

  select * into v_tier from public.plan_tiers where id = v_request.tier_id;

  -- Lock the member's current active plan (if any) — the streak decision and
  -- the scheduled start date both depend on it.
  select * into v_old from public.plans
    where user_id = v_request.user_id and is_active
    for update;
  v_has_old := found;

  -- One queued renewal at a time; approving a second would strand it.
  if exists (
    select 1 from public.plans
    where user_id = v_request.user_id and is_scheduled
  ) then
    raise exception 'Member already has a scheduled plan' using errcode = 'P0001';
  end if;

  -- Streak rule: payment (this approval) on or before the current plan's
  -- end_date continues the streak. end_date already includes freeze
  -- extensions, so freezes never break a streak.
  v_on_time := v_has_old and v_today <= v_old.end_date;

  if v_on_time then
    v_streak := v_old.streak_month + 1;
    -- Early renewal: queue the new plan right after the current one instead
    -- of throwing away the member's remaining days. p_start_date is ignored
    -- on purpose — the chain must stay contiguous.
    v_start := v_old.end_date + 1;
    v_scheduled := true;
  else
    v_streak := 1;
    v_start := coalesce(p_start_date, current_date);
    -- Expired (or missing) plan: same as before — retire it and start fresh.
    update public.plans set is_active = false
      where user_id = v_request.user_id and is_active;
  end if;

  select sex into v_sex from public.profiles where id = v_request.user_id;
  v_base := case
    when v_sex = 'female' then v_tier.price_female_ron
    else v_tier.price_male_ron
  end;
  v_discount := case
    when v_tier.category = 'monthly' then public.streak_discount_ron(v_streak)
    else 0
  end;

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, payment_method,
    is_active, is_scheduled,
    streak_month, discount_ron, price_paid_ron
  )
  values (
    v_request.user_id, v_tier.id, v_start,
    -- Inclusive end-of-period: start + duration months − 1 day.
    (v_start::timestamp
       + (v_tier.duration_months * interval '1 month')
       - interval '1 day')::date,
    v_tier.sessions_per_month * v_tier.duration_months,
    p_payment_method,
    not v_scheduled, v_scheduled,
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

-- ============ ACTIVATE SCHEDULED PLANS (daily cron) ============

create or replace function public.activate_due_scheduled_plans()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Europe/Bucharest')::date;
  v_count int := 0;
  r record;
begin
  for r in
    select id, user_id from public.plans
    where is_scheduled and start_date <= v_today
    for update
  loop
    -- Retire whatever is still active first — plans_one_active_per_user.
    update public.plans set is_active = false
      where user_id = r.user_id and is_active;
    update public.plans set is_active = true, is_scheduled = false
      where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Cron-only: callable via the service role, not by members.
revoke all on function public.activate_due_scheduled_plans() from public;
grant execute on function public.activate_due_scheduled_plans() to service_role;

-- ============ FREEZE MEMBERSHIP ============
-- Same as 0003 plus: a queued (scheduled) renewal shifts together with the
-- frozen plan so the chain stays contiguous. Also drops 0003's no-op sanity
-- stub.

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

  -- Keep a queued renewal contiguous with the newly extended plan.
  update public.plans
    set start_date = start_date + p_duration_days,
        end_date = end_date + p_duration_days
    where user_id = v_user_id and is_scheduled;

  return v_freeze;
end;
$$;

revoke all on function public.freeze_membership(date, int) from public;
grant execute on function public.freeze_membership(date, int) to authenticated;

commit;
