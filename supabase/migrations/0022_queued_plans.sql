-- ================================================================
-- Queued plans: a member with an active plan can request a renewal.
-- On approval the new plan is stored as `queued` and activates by itself
-- the moment the current plan can no longer cover a booking (sessions
-- exhausted or end_date passed). Recurring auto-bookings therefore keep
-- going across the renewal instead of failing on the 3rd session.
--
-- Schema:
--   plans.status        'queued' | 'active' | 'ended'
--   plans.activated_at  when the plan became active
--   is_active stays and is kept consistent with status by a CHECK, so the
--   many `is_active = true` read sites keep working unchanged.
--
-- Functions (all writers of plans.status live here):
--   studio_today()                  Bucharest calendar date
--   activate_queued_plan()          end current plan, flip queued → active
--   resolve_plan_for_booking()      shared by book_session / book_session_for
--   book_session()                  member booking (grace when nothing queued)
--   book_session_for()              admin/service booking (+ p_allow_grace)
--   approve_plan_request()          queue vs activate immediately
--   activate_due_queued_plans()     daily cron: date-based expiry
--
-- Run after 0021_notifications.sql.
-- ================================================================

begin;

-- ============ SCHEMA ============

alter table public.plans
  add column if not exists status text not null default 'active',
  add column if not exists activated_at timestamptz;

-- Existing rows: active ↔ ended. `activated_at` stays NULL for them (it
-- records activations made by the functions below; the daily sync uses it
-- to notify recently activated plans and must not re-announce old ones).
update public.plans
  set status = case when is_active then 'active' else 'ended' end;

alter table public.plans
  add constraint plans_status_check
    check (status in ('queued', 'active', 'ended')),
  add constraint plans_status_is_active_consistent
    check (is_active = (status = 'active'));

create unique index if not exists plans_one_queued_per_user
  on public.plans (user_id) where status = 'queued';

create or replace function public.studio_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Europe/Bucharest')::date
$$;

-- ============ ACTIVATE QUEUED PLAN ============
--
-- Activation date = the later of today (or the explicit date) and the day
-- after the member's last booked session. Bookings made on the previous
-- plan may still be in the future; the new plan's month must not start
-- before they have happened, otherwise a 12-session plan booked two weeks
-- ahead would expire before its own last sessions.
--
-- Order matters for the `plans_one_active_per_user` unique index: end the
-- old plan in its own statement BEFORE flipping the new one.

create or replace function public.activate_queued_plan(
  p_plan_id uuid,
  p_activation_date date default null
)
returns public.plans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
  v_tier public.plan_tiers;
  v_last_booked date;
  v_start date;
begin
  select * into v_plan from public.plans where id = p_plan_id for update;
  if not found or v_plan.status <> 'queued' then
    raise exception 'Plan not queued' using errcode = 'P0001';
  end if;

  select * into v_tier from public.plan_tiers where id = v_plan.tier_id;

  select max((s.start_at at time zone 'Europe/Bucharest')::date)
    into v_last_booked
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_plan.user_id and b.status = 'booked';

  v_start := greatest(
    coalesce(p_activation_date, public.studio_today()),
    coalesce(v_last_booked + 1, public.studio_today())
  );

  update public.plans
    set status = 'ended', is_active = false
    where user_id = v_plan.user_id and status = 'active';

  update public.plans
    set status = 'active',
        is_active = true,
        activated_at = now(),
        start_date = v_start,
        end_date = (v_start::timestamp
                      + (v_tier.duration_months * interval '1 month')
                      - interval '1 day')::date
    where id = p_plan_id
    returning * into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.activate_queued_plan(uuid, date) from public;
grant execute on function public.activate_queued_plan(uuid, date) to service_role;

-- ============ RESOLVE PLAN FOR A BOOKING ============
--
-- Returns the plan a booking on `p_session_date` should draw from:
--   * the active plan when it still covers the date and has sessions left;
--   * otherwise the queued plan, activated on the spot;
--   * otherwise the (unusable or NULL) active plan — the caller decides
--     whether grace applies.
-- Takes a per-member advisory lock so two concurrent bookings cannot both
-- miss the flip (with row locks alone, READ COMMITTED re-checks the WHERE
-- after the lock and the second transaction would see neither row).

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
  v_queued public.plans;
begin
  perform pg_advisory_xact_lock(hashtext('plan:' || p_user_id::text));

  select * into v_active
  from public.plans
  where user_id = p_user_id and status = 'active'
  for update;

  if v_active.id is not null
     and v_active.end_date >= p_session_date
     and v_active.sessions_used < v_active.sessions_total
  then
    return v_active;
  end if;

  select * into v_queued
  from public.plans
  where user_id = p_user_id and status = 'queued'
  for update;

  if v_queued.id is not null then
    return public.activate_queued_plan(v_queued.id);
  end if;

  return v_active;
end;
$$;

revoke all on function public.resolve_plan_for_booking(uuid, date) from public;

-- ============ BOOK SESSION (member) ============

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
  v_grace boolean := false;
  v_grace_cap constant int := 2;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Lock the session row to prevent concurrent overbooking
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  -- Unlock window
  if v_session.unlock_at > now() then
    raise exception 'Session not yet bookable' using errcode = 'P0001';
  end if;

  -- Capacity
  if v_session.booked_count >= v_session.capacity then
    raise exception 'Session is full' using errcode = 'P0001';
  end if;

  v_session_date := (v_session.start_at at time zone 'Europe/Bucharest')::date;

  -- Plan: active if usable, else a queued one is activated, else grace.
  v_plan := public.resolve_plan_for_booking(v_user_id, v_session_date);
  if v_plan.id is null then
    raise exception 'No active plan' using errcode = 'P0001';
  end if;

  if v_plan.end_date < v_session_date
     or v_plan.sessions_used >= v_plan.sessions_total
  then
    -- resolve() already activated a queued plan if there was one, so
    -- reaching here means nothing is queued: grace applies.
    if v_plan.grace_used >= v_grace_cap then
      raise exception 'Grace bookings exhausted, please renew plan'
        using errcode = 'P0001';
    end if;
    v_grace := true;
  end if;

  -- One booking per calendar date (in Bucharest time)
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

  insert into public.bookings (user_id, session_id, status, iso_week, is_grace)
  values (v_user_id, p_session_id, 'booked', v_iso_week, v_grace)
  returning * into v_booking;

  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;

  if v_grace then
    update public.plans set grace_used = grace_used + 1 where id = v_plan.id;
  else
    update public.plans set sessions_used = sessions_used + 1 where id = v_plan.id;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.book_session(uuid) from public;
grant execute on function public.book_session(uuid) to authenticated;

-- ============ BOOK SESSION FOR (admin / service) ============
--
-- Signature gains `p_allow_grace` (default true). The 2-arg version is
-- dropped so PostgREST never sees an ambiguous overload.

drop function if exists public.book_session_for(uuid, uuid);

create or replace function public.book_session_for(
  p_user_id uuid,
  p_session_id uuid,
  p_allow_grace boolean default true
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
  v_grace boolean := false;
  v_grace_cap constant int := 2;
begin
  -- Allowed callers: an authenticated admin, or the service-role key
  -- (daily sync / server actions, which run with no auth.uid()).
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

  if v_plan.end_date < v_session_date
     or v_plan.sessions_used >= v_plan.sessions_total
  then
    if not p_allow_grace then
      if v_plan.end_date < v_session_date then
        raise exception 'Plan expires before session date' using errcode = 'P0001';
      end if;
      raise exception 'No sessions remaining on plan' using errcode = 'P0001';
    end if;
    if v_plan.grace_used >= v_grace_cap then
      raise exception 'Grace bookings exhausted, please renew plan'
        using errcode = 'P0001';
    end if;
    v_grace := true;
  end if;

  -- Same-day check (admin still respects "one booking per calendar date").
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

  insert into public.bookings (user_id, session_id, status, iso_week, is_grace)
  values (p_user_id, p_session_id, 'booked', v_iso_week, v_grace)
  returning * into v_booking;

  update public.sessions
    set booked_count = booked_count + 1
    where id = p_session_id;

  if v_grace then
    update public.plans set grace_used = grace_used + 1 where id = v_plan.id;
  else
    update public.plans set sessions_used = sessions_used + 1 where id = v_plan.id;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.book_session_for(uuid, uuid, boolean) from public;
grant execute on function public.book_session_for(uuid, uuid, boolean) to authenticated;
grant execute on function public.book_session_for(uuid, uuid, boolean) to service_role;

-- ============ APPROVE PLAN REQUEST ============
--
-- If the member's active plan is still usable today, the new plan is
-- queued (provisional dates, recomputed on activation). Otherwise it is
-- activated right away, starting on `p_start_date` (default today).
-- Returns the plan row; the caller inspects `status`.

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
  v_today date := public.studio_today();
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

  if v_active.id is not null
     and v_active.end_date >= v_today
     and v_active.sessions_used < v_active.sessions_total
  then
    if exists (
      select 1 from public.plans
      where user_id = v_request.user_id and status = 'queued'
    ) then
      raise exception 'A queued plan already exists' using errcode = 'P0001';
    end if;

    insert into public.plans (
      user_id, tier_id, start_date, end_date,
      sessions_total, payment_method, is_active, status
    )
    values (
      v_request.user_id, v_tier.id, v_today,
      (v_today::timestamp
         + (v_tier.duration_months * interval '1 month')
         - interval '1 day')::date,
      v_tier.sessions_per_month * v_tier.duration_months,
      p_payment_method, false, 'queued'
    )
    returning * into v_plan;
  else
    v_start := coalesce(p_start_date, v_today);

    update public.plans
      set status = 'ended', is_active = false
      where user_id = v_request.user_id and status = 'active';

    insert into public.plans (
      user_id, tier_id, start_date, end_date,
      sessions_total, payment_method, is_active, status, activated_at
    )
    values (
      v_request.user_id, v_tier.id, v_start,
      (v_start::timestamp
         + (v_tier.duration_months * interval '1 month')
         - interval '1 day')::date,
      v_tier.sessions_per_month * v_tier.duration_months,
      p_payment_method, true, 'active', now()
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

-- ============ DAILY: ACTIVATE QUEUED PLANS WHOSE PREDECESSOR EXPIRED ============
--
-- Session exhaustion is handled lazily at booking time; this covers the
-- date-based case (member stopped booking, plan ran out by date) so the
-- queued plan starts and recurring pins resume.

create or replace function public.activate_due_queued_plans()
returns setof public.plans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_q public.plans;
  v_a public.plans;
  v_today date := public.studio_today();
begin
  for v_q in select * from public.plans where status = 'queued' loop
    perform pg_advisory_xact_lock(hashtext('plan:' || v_q.user_id::text));
    select * into v_a
    from public.plans
    where user_id = v_q.user_id and status = 'active';
    if v_a.id is null or v_a.end_date < v_today then
      return next public.activate_queued_plan(v_q.id, v_today);
    end if;
  end loop;
  return;
end;
$$;

revoke all on function public.activate_due_queued_plans() from public;
grant execute on function public.activate_due_queued_plans() to service_role;

commit;
