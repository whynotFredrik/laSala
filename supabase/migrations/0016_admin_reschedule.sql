-- 0016_admin_reschedule.sql
--
-- Lets admins reschedule any member's booking, bypassing the ownership
-- check, the 3-hour cancellation window, and the weekly change cap.
-- (cancel_booking already has the same admin bypass.)
--
-- Member behavior is unchanged.

begin;

create or replace function public.reschedule_booking(p_booking_id uuid, p_new_session_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_admin boolean := public.is_admin();
  v_booking public.bookings;
  v_old_session public.sessions;
  v_new_session public.sessions;
  v_existing_same_day uuid;
  v_new_iso_week text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.user_id <> v_user_id and not v_is_admin then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'Booking not active' using errcode = 'P0001';
  end if;

  -- Weekly reschedule cap (members only; admins bypass).
  if not v_is_admin and v_booking.reschedule_count_iso_week >= 2 then
    raise exception 'Reschedule limit reached for this week' using errcode = 'P0001';
  end if;

  select * into v_old_session from public.sessions where id = v_booking.session_id for update;
  select * into v_new_session from public.sessions where id = p_new_session_id for update;
  if not found then
    raise exception 'New session not found' using errcode = 'P0002';
  end if;

  -- Unlock + capacity still apply to admin moves — we don't want admins to
  -- accidentally jam a member into an already-full session, and unlock-at
  -- only matters before sessions go on sale (which by definition is past
  -- by the time an admin is moving someone).
  if not v_is_admin and v_new_session.unlock_at > now() then
    raise exception 'New session not yet bookable' using errcode = 'P0001';
  end if;
  if v_new_session.booked_count >= v_new_session.capacity then
    raise exception 'New session is full' using errcode = 'P0001';
  end if;

  -- 3-hour pre-session window (members only; admins bypass).
  if not v_is_admin and v_old_session.start_at - now() < interval '3 hours' then
    raise exception 'Cannot reschedule within 3 hours of original session' using errcode = 'P0001';
  end if;

  -- Same-day check excluding the current booking
  select b.id into v_existing_same_day
  from public.bookings b
  join public.sessions s on s.id = b.session_id
  where b.user_id = v_booking.user_id  -- not v_user_id — admin is acting on member
    and b.status = 'booked'
    and b.id <> p_booking_id
    and (s.start_at at time zone 'Europe/Bucharest')::date
        = (v_new_session.start_at at time zone 'Europe/Bucharest')::date;
  if v_existing_same_day is not null then
    raise exception 'Already booked for the new date' using errcode = 'P0001';
  end if;

  v_new_iso_week := to_char(
    (v_new_session.start_at at time zone 'Europe/Bucharest')::date,
    'IYYY-"W"IW'
  );

  -- Move counters
  update public.sessions set booked_count = booked_count - 1 where id = v_old_session.id;
  update public.sessions set booked_count = booked_count + 1 where id = v_new_session.id;

  update public.bookings
    set session_id = p_new_session_id,
        iso_week = v_new_iso_week,
        reschedule_count_iso_week = reschedule_count_iso_week + 1
    where id = p_booking_id
    returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.reschedule_booking(uuid, uuid) from public;
grant execute on function public.reschedule_booking(uuid, uuid) to authenticated;

commit;
