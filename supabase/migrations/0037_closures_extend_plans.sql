-- ================================================================
-- Studio closures extend active plans (studio decision, Nov 2026 —
-- replaces the "plans are NOT extended" rule of 0036).
--
--   * Closing a day extends every plan that was running on it by one day:
--     status = 'active' and start_date <= day <= end_date. Plans that end
--     before the day, or start after it, are not touched; members without
--     an active plan get nothing. A member frozen on that day is skipped:
--     the freeze already gave them the day back (0032).
--   * Only days newly closed by the call count. Re-closing a day that is
--     already closed (e.g. to change the reason) extends nothing.
--   * A range is processed day by day, oldest first, against the end_date
--     as it stands after the previous day: a plan ending on Dec 1 with
--     Dec 1 and Dec 2 closed is running on both and gets +2 days. The same
--     holds when the extension lands on a day closed in an earlier call.
--   * Each extension is recorded in studio_closure_extensions (one row per
--     closed day and plan), so reopening the day can undo exactly it.
--   * Reopening a day that is today or later shortens each plan it
--     extended by one day again, if that plan is still active (a plan that
--     has since been renewed or ended keeps the day: on-time renewals
--     carry the old end_date into the new plan, 0027). Bookings the member
--     made beyond the shortened end_date are cancelled through
--     cancel_booking. Reopening a past day removes the closure only.
--   * Plan rows are changed under the same per-member advisory lock as
--     approve_plan_request / resolve_plan_for_booking.
--   * Upcoming days already closed under 0036 (closed_on >= studio_today())
--     are backfilled once below, without notifications.
--
-- admin_close_studio_days and admin_reopen_studio_day now return jsonb
-- (shapes documented on each function) so the app can tell members about
-- the extension.
-- Run after 0036_studio_closures.sql.
-- ================================================================

begin;

-- ============ TABLE ============

create table if not exists public.studio_closure_extensions (
  closed_on date not null references public.studio_closures(closed_on) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (closed_on, plan_id)
);

create index if not exists studio_closure_extensions_user_idx
  on public.studio_closure_extensions (user_id);

alter table public.studio_closure_extensions enable row level security;

drop policy if exists "members read own closure extensions" on public.studio_closure_extensions;
create policy "members read own closure extensions"
  on public.studio_closure_extensions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "admins read closure extensions" on public.studio_closure_extensions;
create policy "admins read closure extensions"
  on public.studio_closure_extensions for select
  to authenticated
  using (public.is_admin());

-- Writes go through the security-definer functions below; no
-- insert/update/delete policy, so direct writes fail.

-- ============ EXTEND PLANS FOR ONE CLOSED DAY (internal) ============
-- Extends every plan running on p_day by one day and records it. Skips a
-- plan already extended for p_day, so it is safe to call twice. When the
-- new end_date lands on another closed day the plan was not yet extended
-- for (e.g. Dec 2 closed earlier, Dec 1 closed now, plan ending Dec 1),
-- that day counts too and the plan moves on again, each step recorded.

create or replace function public.extend_plans_for_closed_day(p_day date)
returns setof public.studio_closure_extensions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_plan public.plans;
  v_row public.studio_closure_extensions;
  v_day date;
begin
  for v_user_id in
    select distinct p.user_id
    from public.plans p
    where p.status = 'active'
      and p.start_date <= p_day
      and p.end_date >= p_day
    order by p.user_id
  loop
    perform pg_advisory_xact_lock(hashtext('plan:' || v_user_id::text));

    -- Re-read under the lock: a renewal may have replaced the plan.
    select * into v_plan
    from public.plans
    where user_id = v_user_id
      and status = 'active'
      and start_date <= p_day
      and end_date >= p_day
    for update;
    continue when not found;
    continue when public.is_frozen_on(v_user_id, p_day);

    v_day := p_day;
    loop
      insert into public.studio_closure_extensions (closed_on, plan_id, user_id)
      values (v_day, v_plan.id, v_user_id)
      on conflict (closed_on, plan_id) do nothing
      returning * into v_row;
      -- No row returned sets v_row to nulls: already extended for v_day.
      exit when v_row.plan_id is null;

      update public.plans
        set end_date = end_date + 1
        where id = v_plan.id
        returning end_date into v_day;

      return next v_row;

      exit when not public.is_studio_closed(v_day)
             or public.is_frozen_on(v_user_id, v_day);
    end loop;
  end loop;

  return;
end;
$$;

revoke all on function public.extend_plans_for_closed_day(date)
  from public, anon, authenticated;

-- ============ CLOSE DAYS ============
-- Returns:
--   {
--     "new_days":  ["2026-12-01", ...],          -- days this call closed
--     "cancelled": [<bookings row>, ...],        -- as 0036 returned them
--     "extended":  [{ "user_id", "plan_id", "days", "dates": [...],
--                     "end_date" }, ...]          -- one entry per plan
--   }

drop function if exists public.admin_close_studio_days(date[], text);

create function public.admin_close_studio_days(
  p_dates date[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_studio_today date := public.studio_today();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_new_days date[];
  v_day date;
  v_booking_id uuid;
  v_booking public.bookings;
  v_cancelled jsonb := '[]'::jsonb;
  v_ext public.studio_closure_extensions;
  v_ext_rows public.studio_closure_extensions[] := '{}';
  v_extended jsonb;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_dates is null or cardinality(p_dates) = 0 then
    raise exception 'No dates given' using errcode = 'P0001';
  end if;

  if exists (select 1 from unnest(p_dates) d where d < v_studio_today) then
    raise exception 'Closure date in the past' using errcode = 'P0001';
  end if;

  -- `do nothing` + returning yields exactly the days this call closed; a
  -- concurrent call closing the same day waits here and then sees it as
  -- already closed, so the day is never extended twice.
  with ins as (
    insert into public.studio_closures (closed_on, reason, created_by)
    select distinct d, v_reason, v_admin_id from unnest(p_dates) d
    on conflict (closed_on) do nothing
    returning closed_on
  )
  select coalesce(array_agg(closed_on order by closed_on), '{}')
  into v_new_days
  from ins;

  -- Days that were already closed keep their extensions; only the reason
  -- changes (as in 0036).
  update public.studio_closures
    set reason = v_reason
    where closed_on = any (p_dates)
      and not (closed_on = any (v_new_days));

  for v_booking_id in
    select b.id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.status = 'booked'
      and (s.start_at at time zone 'Europe/Bucharest')::date = any (p_dates)
    order by s.start_at
  loop
    v_booking := public.cancel_booking(v_booking_id);

    delete from public.recurring_skips
    where user_id = v_booking.user_id and session_id = v_booking.session_id;

    v_cancelled := v_cancelled || jsonb_build_array(to_jsonb(v_booking));
  end loop;

  -- After the cancellations: from here on this transaction takes no more
  -- session locks, only plan locks (in user_id order).
  foreach v_day in array v_new_days loop
    for v_ext in select * from public.extend_plans_for_closed_day(v_day) loop
      v_ext_rows := v_ext_rows || v_ext;
    end loop;
  end loop;

  select coalesce(jsonb_agg(x order by x->>'user_id'), '[]'::jsonb)
  into v_extended
  from (
    select jsonb_build_object(
      'user_id', e.user_id,
      'plan_id', e.plan_id,
      'days', count(*),
      'dates', jsonb_agg(e.closed_on order by e.closed_on),
      'end_date', p.end_date
    ) as x
    from unnest(v_ext_rows) e
    join public.plans p on p.id = e.plan_id
    group by e.user_id, e.plan_id, p.end_date
  ) agg;

  return jsonb_build_object(
    'new_days', to_jsonb(v_new_days),
    'cancelled', v_cancelled,
    'extended', v_extended
  );
end;
$$;

revoke all on function public.admin_close_studio_days(date[], text) from public;
grant execute on function public.admin_close_studio_days(date[], text) to authenticated;

-- ============ REOPEN DAY ============
-- Returns:
--   {
--     "shortened": [{ "user_id", "plan_id", "end_date" }, ...],
--     "cancelled": [<bookings row>, ...]  -- bookings past a shortened end
--   }

drop function if exists public.admin_reopen_studio_day(date);

create function public.admin_reopen_studio_day(p_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ext public.studio_closure_extensions;
  v_plan public.plans;
  v_booking_id uuid;
  v_booking public.bookings;
  v_shortened jsonb := '[]'::jsonb;
  v_cancelled jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_date >= public.studio_today() then
    for v_ext in
      select * from public.studio_closure_extensions
      where closed_on = p_date
      order by user_id
    loop
      perform pg_advisory_xact_lock(hashtext('plan:' || v_ext.user_id::text));

      update public.plans
        set end_date = end_date - 1
        where id = v_ext.plan_id
          and status = 'active'
          and end_date > start_date
        returning * into v_plan;
      continue when not found;

      v_shortened := v_shortened || jsonb_build_array(jsonb_build_object(
        'user_id', v_plan.user_id,
        'plan_id', v_plan.id,
        'end_date', v_plan.end_date
      ));

      -- A booking on the day that is no longer covered.
      for v_booking_id in
        select b.id
        from public.bookings b
        join public.sessions s on s.id = b.session_id
        where b.user_id = v_plan.user_id
          and b.status = 'booked'
          and (s.start_at at time zone 'Europe/Bucharest')::date > v_plan.end_date
          and s.start_at > now()
        order by s.start_at
      loop
        v_booking := public.cancel_booking(v_booking_id);
        v_cancelled := v_cancelled || jsonb_build_array(to_jsonb(v_booking));
      end loop;
    end loop;
  end if;

  -- Cascades to studio_closure_extensions.
  delete from public.studio_closures where closed_on = p_date;

  return jsonb_build_object(
    'shortened', v_shortened,
    'cancelled', v_cancelled
  );
end;
$$;

revoke all on function public.admin_reopen_studio_day(date) from public;
grant execute on function public.admin_reopen_studio_day(date) to authenticated;

-- ============ BACKFILL ============
-- Upcoming days closed under 0036 get the extension now (no notification).

do $$
declare
  v_day date;
begin
  for v_day in
    select c.closed_on
    from public.studio_closures c
    where c.closed_on >= public.studio_today()
    order by c.closed_on
  loop
    perform public.extend_plans_for_closed_day(v_day);
  end loop;
end;
$$;

commit;
