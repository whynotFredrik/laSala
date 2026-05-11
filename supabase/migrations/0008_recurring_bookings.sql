-- ================================================================
-- Recurring bookings: pin a member to a specific schedule slot so they
-- get auto-booked every time the studio generates a week of sessions.
-- Run after 0007_fix_approve_plan.sql.
-- ================================================================

create table if not exists public.recurring_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  schedule_template_id uuid not null
    references public.schedule_template(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  is_active boolean not null default true
);

-- A member can be pinned to each slot at most once. Drop a recurring
-- entry to free the seat up for another member.
create unique index if not exists recurring_bookings_unique_active
  on public.recurring_bookings (user_id, schedule_template_id)
  where is_active;

create index if not exists recurring_bookings_template_idx
  on public.recurring_bookings (schedule_template_id) where is_active;

alter table public.recurring_bookings enable row level security;

drop policy if exists "users read own recurring" on public.recurring_bookings;
create policy "users read own recurring"
  on public.recurring_bookings for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage recurring" on public.recurring_bookings;
create policy "admins manage recurring"
  on public.recurring_bookings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ BOOK_SESSION_FOR — admin-only booking on behalf ============
-- Same checks as book_session except auth.uid() is replaced by the admin's
-- explicit `p_user_id` argument. Admins bypass the unlock window and the
-- 3-hour cancel-lock (recurring bookings often get inserted for sessions
-- months out, which would fail the unlock check).
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
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002';
  end if;

  if v_session.booked_count >= v_session.capacity then
    raise exception 'Session is full' using errcode = 'P0001';
  end if;

  select * into v_plan
  from public.plans
  where user_id = p_user_id and is_active
  for update;
  if not found then
    raise exception 'No active plan' using errcode = 'P0001';
  end if;
  if v_plan.end_date < (v_session.start_at at time zone 'Europe/Bucharest')::date then
    raise exception 'Plan expires before session date' using errcode = 'P0001';
  end if;
  if v_plan.sessions_used >= v_plan.sessions_total then
    raise exception 'No sessions remaining on plan' using errcode = 'P0001';
  end if;

  -- Same-day check (admin still respects "one booking per calendar date").
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = p_user_id
    and b.status = 'booked'
    and (s.start_at at time zone 'Europe/Bucharest')::date
        = (v_session.start_at at time zone 'Europe/Bucharest')::date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for this date' using errcode = 'P0001';
  end if;

  v_iso_week := to_char(
    (v_session.start_at at time zone 'Europe/Bucharest')::date,
    'IYYY-"W"IW'
  );

  insert into public.bookings (user_id, session_id, status, iso_week)
  values (p_user_id, p_session_id, 'booked', v_iso_week)
  returning * into v_booking;

  update public.sessions
    set booked_count = booked_count + 1
    where id = p_session_id;
  update public.plans
    set sessions_used = sessions_used + 1
    where id = v_plan.id;

  return v_booking;
end;
$$;

revoke all on function public.book_session_for(uuid, uuid) from public;
grant execute on function public.book_session_for(uuid, uuid) to authenticated;
