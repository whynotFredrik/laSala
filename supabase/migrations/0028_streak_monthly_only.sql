-- ================================================================
-- Streak is for month-to-month plans only.
--
-- Studio rule (Sep 2026): members on a promotion (the 6-month "5+1"
-- packages) have no consistency streak. Until now a promo renewal kept
-- the counter going (without a discount); now the streak continues only
-- when BOTH the current plan and the new one are monthly tiers. A promo
-- plan always carries streak_month = 1, and the first monthly plan after
-- a promo starts at 1 as well.
--
-- The merge-on-renewal rule (0027) is unchanged: an on-time renewal —
-- promo or monthly — still carries the unused sessions over and extends
-- the validity from the current end_date.
--
-- Run after 0027_renewal_merges_sessions.sql.
-- ================================================================

begin;

-- Promo plans never hold a streak (no-op on the live data, kept for safety).
update public.plans p
set streak_month = 1
from public.plan_tiers t
where t.id = p.tier_id and t.category <> 'monthly' and p.streak_month <> 1;

-- ============ APPROVE PLAN REQUEST ============

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
  v_active_category text;
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
  if v_active.id is not null then
    select category into v_active_category
    from public.plan_tiers where id = v_active.tier_id;
  end if;

  -- On time = approved (paid) no later than the current plan's end_date.
  v_on_time := v_active.id is not null and v_today <= v_active.end_date;

  -- Streak: monthly → monthly, on time. Promotions never hold a streak.
  v_streak := case
    when v_on_time
         and v_tier.category = 'monthly'
         and v_active_category = 'monthly'
      then v_active.streak_month + 1
    else 1
  end;

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

-- ============ ADMIN GRANT PLAN — streak only on monthly tiers ============

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
  v_streak int;
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
  v_streak := case when v_tier.category = 'monthly' then p_streak_month else 1 end;

  perform pg_advisory_xact_lock(hashtext('plan:' || p_user_id::text));

  update public.plans
    set status = 'ended', is_active = false
    where user_id = p_user_id and status = 'active';

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
    true, 'active', now(), v_streak
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.admin_grant_plan(uuid, uuid, date, int, int) from public;
grant execute on function public.admin_grant_plan(uuid, uuid, date, int, int) to authenticated;

commit;
