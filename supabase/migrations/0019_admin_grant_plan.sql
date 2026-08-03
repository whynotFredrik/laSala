-- 0019_admin_grant_plan.sql
--
-- Admin onboarding of existing gym members: grant a plan directly (no plan
-- request needed), choosing the tier, how many sessions the member has left,
-- the start date, and the streak month ("vechimea") they've already earned
-- by training consecutively before the app existed.
--
-- The function is atomic: it retires the member's current active plan (if
-- any), clears a queued renewal (admin override), and inserts the new active
-- plan. No price is recorded (price_paid_ron stays null) — these plans were
-- paid outside the app.
--
-- Run after 0018_renewal_streak.sql.

begin;

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

  -- Admin override: retire whatever is in the way — the current active plan
  -- and any queued renewal.
  update public.plans set is_scheduled = false
    where user_id = p_user_id and is_scheduled;
  update public.plans set is_active = false
    where user_id = p_user_id and is_active;

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, sessions_used,
    is_active, streak_month
  )
  values (
    p_user_id, v_tier.id, p_start_date,
    -- Inclusive end-of-period: start + duration months − 1 day.
    (p_start_date::timestamp
       + (v_tier.duration_months * interval '1 month')
       - interval '1 day')::date,
    v_total, v_total - v_remaining,
    true, p_streak_month
  )
  returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.admin_grant_plan(uuid, uuid, date, int, int) from public;
grant execute on function public.admin_grant_plan(uuid, uuid, date, int, int) to authenticated;

commit;
