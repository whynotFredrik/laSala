-- ================================================================
-- Fix `approve_plan_request`. The original `end_date` calculation tried
-- to cast an interval to an int, which Postgres rejects:
--
--   p_start_date + (duration_months * interval '1 month' - interval '1 day')::int
--                                                                          ^^^^^
--   ERROR: cannot cast type interval to integer
--
-- Replace with proper date arithmetic — promote start_date to timestamp,
-- add the interval, subtract one day, cast back to date.
-- Run after 0006_weekly_change_cap.sql.
-- ================================================================

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

  -- Deactivate any existing active plan for that user (the partial unique
  -- index `plans_one_active_per_user` would otherwise reject the insert).
  update public.plans set is_active = false
    where user_id = v_request.user_id and is_active;

  insert into public.plans (
    user_id, tier_id, start_date, end_date,
    sessions_total, payment_method, is_active
  )
  values (
    v_request.user_id, v_tier.id, p_start_date,
    -- Inclusive end-of-period: start + duration months − 1 day.
    -- Promote to timestamp so the interval arithmetic is well-typed,
    -- then cast back to date for the column.
    (p_start_date::timestamp
       + (v_tier.duration_months * interval '1 month')
       - interval '1 day')::date,
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
