-- ================================================================
-- Admin freeze management.
--
-- The member rule stays: at most 14 freeze days in a rolling 6-month
-- window, 3-14 days per freeze, starting at least 48h out. On top of it
-- the admin can now:
--
--   * allocate a freeze to a member (admin_freeze_membership): same 3-14
--     days and allowance check, but no 48h notice — it may start today.
--   * set how many freeze days a member has left
--     (admin_set_freeze_remaining): stored as a per-member override in
--     freeze_allowance_overrides. From `set_at` on, the member's allowance
--     is `remaining_days` minus the freezes created after `set_at`. The
--     override lapses on `expires_on` (6 months after it was set) or when
--     the admin clears it (admin_clear_freeze_override); the normal
--     14-days-per-6-months rule applies again afterwards.
--
-- freeze_days_remaining(user) is the single place the allowance is
-- computed; freeze_membership and the admin pages both use it.
-- Run after 0032_freeze_blocks_bookings.sql.
-- ================================================================

begin;

-- ============ OVERRIDES ============

create table if not exists public.freeze_allowance_overrides (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  remaining_days int not null check (remaining_days between 0 and 365),
  set_at timestamptz not null default now(),
  expires_on date not null,
  set_by uuid references public.profiles(id) on delete set null
);

alter table public.freeze_allowance_overrides enable row level security;

drop policy if exists "members read own freeze override" on public.freeze_allowance_overrides;
create policy "members read own freeze override"
  on public.freeze_allowance_overrides for select
  using (user_id = auth.uid());

drop policy if exists "admins read freeze overrides" on public.freeze_allowance_overrides;
create policy "admins read freeze overrides"
  on public.freeze_allowance_overrides for select
  using (public.is_admin());

-- Writes go through admin_set_freeze_remaining / admin_clear_freeze_override
-- (security definer); no insert/update/delete policy, so direct writes fail.

-- ============ REMAINING DAYS ============

create or replace function public.freeze_days_remaining(p_user_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_override public.freeze_allowance_overrides;
  v_used int;
begin
  if not (
    p_user_id = auth.uid() or public.is_admin() or auth.role() = 'service_role'
  ) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_override
  from public.freeze_allowance_overrides
  where user_id = p_user_id and expires_on >= current_date;

  if found then
    select coalesce(sum(duration_days), 0) into v_used
    from public.freeze_periods
    where user_id = p_user_id and created_at >= v_override.set_at;
    return greatest(v_override.remaining_days - v_used, 0);
  end if;

  select coalesce(sum(duration_days), 0) into v_used
  from public.freeze_periods
  where user_id = p_user_id
    and start_date >= current_date - interval '180 days';
  return greatest(14 - v_used, 0);
end;
$$;

revoke all on function public.freeze_days_remaining(uuid) from public, anon;
grant execute on function public.freeze_days_remaining(uuid) to authenticated, service_role;

-- ============ CREATE FREEZE (internal) ============
-- Shared by the member and admin entry points, which do the caller checks.
-- Not executable by clients.

create or replace function public.create_freeze_internal(
  p_user_id uuid,
  p_start_date date,
  p_duration_days int
)
returns public.freeze_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.plans;
  v_end_date date := p_start_date + (p_duration_days - 1);
  v_freeze public.freeze_periods;
  v_booking_id uuid;
begin
  if p_duration_days < 3 or p_duration_days > 14 then
    raise exception 'Duration must be 3-14 days' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans
    where user_id = p_user_id and status = 'active' for update;
  if not found then
    raise exception 'No active plan to freeze' using errcode = 'P0001';
  end if;

  if public.freeze_days_remaining(p_user_id) < p_duration_days then
    raise exception 'Freeze allowance exceeded' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.freeze_periods
    where user_id = p_user_id
      and daterange(start_date, end_date, '[]')
          && daterange(p_start_date, v_end_date, '[]')
  ) then
    raise exception 'Freeze overlaps an existing freeze' using errcode = 'P0001';
  end if;

  insert into public.freeze_periods (user_id, plan_id, start_date, end_date)
  values (p_user_id, v_plan.id, p_start_date, v_end_date)
  returning * into v_freeze;

  update public.plans
    set end_date = end_date + p_duration_days
    where id = v_plan.id;

  -- Bookings already held inside the window (0032).
  for v_booking_id in
    select b.id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.user_id = p_user_id
      and b.status = 'booked'
      and (s.start_at at time zone 'Europe/Bucharest')::date
          between p_start_date and v_end_date
  loop
    perform public.cancel_booking(v_booking_id);
  end loop;

  return v_freeze;
end;
$$;

revoke all on function public.create_freeze_internal(uuid, date, int)
  from public, anon, authenticated;

-- ============ FREEZE MEMBERSHIP (member) ============

create or replace function public.freeze_membership(p_start_date date, p_duration_days int)
returns public.freeze_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_start_date < (current_date + 2) then
    raise exception 'Freeze must start at least 48 hours from now' using errcode = 'P0001';
  end if;

  return public.create_freeze_internal(v_user_id, p_start_date, p_duration_days);
end;
$$;

revoke all on function public.freeze_membership(date, int) from public, anon;
grant execute on function public.freeze_membership(date, int) to authenticated;

-- ============ ADMIN: ALLOCATE A FREEZE ============

create or replace function public.admin_freeze_membership(
  p_user_id uuid,
  p_start_date date,
  p_duration_days int
)
returns public.freeze_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_start_date < current_date then
    raise exception 'Freeze cannot start in the past' using errcode = 'P0001';
  end if;

  return public.create_freeze_internal(p_user_id, p_start_date, p_duration_days);
end;
$$;

revoke all on function public.admin_freeze_membership(uuid, date, int) from public, anon;
grant execute on function public.admin_freeze_membership(uuid, date, int) to authenticated;

-- ============ ADMIN: SET / CLEAR REMAINING DAYS ============

create or replace function public.admin_set_freeze_remaining(
  p_user_id uuid,
  p_remaining_days int
)
returns public.freeze_allowance_overrides
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.freeze_allowance_overrides;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  if p_remaining_days < 0 or p_remaining_days > 365 then
    raise exception 'Remaining days out of range' using errcode = 'P0001';
  end if;

  insert into public.freeze_allowance_overrides
    (user_id, remaining_days, set_at, expires_on, set_by)
  values
    (p_user_id, p_remaining_days, now(), current_date + 180, auth.uid())
  on conflict (user_id) do update
    set remaining_days = excluded.remaining_days,
        set_at = excluded.set_at,
        expires_on = excluded.expires_on,
        set_by = excluded.set_by
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_set_freeze_remaining(uuid, int) from public, anon;
grant execute on function public.admin_set_freeze_remaining(uuid, int) to authenticated;

create or replace function public.admin_clear_freeze_override(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  delete from public.freeze_allowance_overrides where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_clear_freeze_override(uuid) from public, anon;
grant execute on function public.admin_clear_freeze_override(uuid) to authenticated;

-- ============ ADMIN: OVERVIEW ============
-- Members with an active plan and their remaining freeze days, in one call.

create or replace function public.admin_freeze_overview()
returns table (
  user_id uuid,
  full_name text,
  email text,
  remaining_days int,
  override_remaining_days int,
  override_expires_on date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    public.freeze_days_remaining(p.id),
    o.remaining_days,
    o.expires_on
  from public.profiles p
  join public.plans pl on pl.user_id = p.id and pl.status = 'active'
  left join public.freeze_allowance_overrides o
    on o.user_id = p.id and o.expires_on >= current_date
  order by p.full_name nulls last, p.email;
end;
$$;

revoke all on function public.admin_freeze_overview() from public, anon;
grant execute on function public.admin_freeze_overview() to authenticated;

-- 0032 functions: not client-callable.
revoke all on function public.is_frozen_on(uuid, date) from anon, authenticated;

commit;
