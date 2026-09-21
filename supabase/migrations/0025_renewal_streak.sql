-- 0025_renewal_streak.sql
--
-- Historical record: applied to the live project through the SQL editor in
-- Aug 2026 (branch claude/app-features-addition-50b8ef, then numbered
-- "0018"). Consistency streak ("Streak de consecvență"): pay the next plan
-- before the current one expires and unlock progressive discounts.
--
--   * Every plan carries `streak_month` (1 = first month, standard price).
--   * Approval no later than the current plan's end_date (Bucharest date)
--     → new plan gets streak_month = old + 1; otherwise 1.
--   * Discount off the sex-based tier price, monthly tiers only:
--       month 2 → 15 RON, month 3 → 30 RON, month 4+ → 40 RON (veteran).
--     6-month promo tiers get no discount but still advance the counter.
--   * The price actually charged is recorded on the plan
--     (`price_paid_ron`, `discount_ron`).
--
-- Only the schema and the discount table are kept here. The original
-- `is_scheduled` renewal mechanism (plans_one_scheduled_per_user,
-- plans_active_not_scheduled, activate_due_scheduled_plans, the
-- approve_plan_request / freeze_membership bodies) is superseded by
-- plans.status = 'queued' (0022) and removed in 0023, which also carries the
-- streak logic inside approve_plan_request.
--
-- Mirror of the discount table lives in lib/plans/streak.ts — keep in sync.

begin;

alter table public.plans
  add column if not exists streak_month int not null default 1
    check (streak_month >= 1),
  add column if not exists discount_ron numeric(10,2) not null default 0
    check (discount_ron >= 0),
  add column if not exists price_paid_ron numeric(10,2);

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

commit;
