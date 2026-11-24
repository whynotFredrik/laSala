-- ================================================================
-- Studio closures (public holidays, days the studio is shut).
--
--   * studio_closures: one row per closed studio date (Europe/Bucharest).
--     Every signed-in user can read it (the member booking page shows the
--     day as closed); writes only through the admin functions below.
--   * is_studio_closed(date): the one place that answers "is the studio
--     closed on this date".
--   * bookings trigger: no row may be 'booked' on a closed date, whichever
--     function writes it — book_session (member), book_session_for (pins,
--     admin), reschedule_booking. Message 'Studio closed on session date'
--     -> skip reason `studioClosed` / booking error `studio_closed`.
--   * admin_close_studio_days(dates, reason): records the closures and
--     cancels every active booking on those dates through cancel_booking,
--     so each member gets the session back on their plan and the spot is
--     freed. Plans are NOT extended (studio decision, Nov 2026). The
--     recurring skip cancel_booking records is dropped again: the member
--     did not choose to skip, so a reopened day books their pin again.
--     Returns the cancelled bookings so the app can notify the members.
--   * admin_reopen_studio_day(date): removes the closure. Cancelled
--     bookings are not restored; pins are booked again by the daily sync.
--
-- Session generation (lib/sessions/ensure-week.ts) skips closed dates.
-- Run after 0035_freeze_from_tomorrow.sql.
-- ================================================================

begin;

-- ============ TABLE ============

create table if not exists public.studio_closures (
  closed_on date primary key,
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.studio_closures enable row level security;

drop policy if exists "signed-in users read studio closures" on public.studio_closures;
create policy "signed-in users read studio closures"
  on public.studio_closures for select
  to authenticated
  using (true);

-- Writes go through admin_close_studio_days / admin_reopen_studio_day
-- (security definer); no insert/update/delete policy, so direct writes fail.

-- ============ IS STUDIO CLOSED ============

create or replace function public.is_studio_closed(p_date date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.studio_closures c where c.closed_on = p_date
  );
$$;

revoke all on function public.is_studio_closed(date) from public;
grant execute on function public.is_studio_closed(date) to authenticated, service_role;

-- ============ NO ACTIVE BOOKING ON A CLOSED DAY ============

create or replace function public.reject_closed_day_booking()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_date date;
begin
  select (s.start_at at time zone 'Europe/Bucharest')::date into v_session_date
  from public.sessions s where s.id = new.session_id;

  if public.is_studio_closed(v_session_date) then
    raise exception 'Studio closed on session date' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_reject_closed_day on public.bookings;
create trigger bookings_reject_closed_day
  before insert or update of status, session_id on public.bookings
  for each row
  when (new.status = 'booked')
  execute function public.reject_closed_day_booking();

-- ============ CLOSE DAYS ============

create or replace function public.admin_close_studio_days(
  p_dates date[],
  p_reason text default null
)
returns setof public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid := auth.uid();
  v_studio_today date := (now() at time zone 'Europe/Bucharest')::date;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_booking_id uuid;
  v_booking public.bookings;
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

  insert into public.studio_closures (closed_on, reason, created_by)
  select distinct d, v_reason, v_admin_id from unnest(p_dates) d
  on conflict (closed_on) do update
    set reason = excluded.reason;

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

    return next v_booking;
  end loop;

  return;
end;
$$;

revoke all on function public.admin_close_studio_days(date[], text) from public;
grant execute on function public.admin_close_studio_days(date[], text) to authenticated;

-- ============ REOPEN DAY ============

create or replace function public.admin_reopen_studio_day(p_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;

  delete from public.studio_closures where closed_on = p_date;
end;
$$;

revoke all on function public.admin_reopen_studio_day(date) from public;
grant execute on function public.admin_reopen_studio_day(date) to authenticated;

commit;
