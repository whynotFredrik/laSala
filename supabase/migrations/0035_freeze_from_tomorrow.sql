-- ================================================================
-- Freeze notice: a member may start a freeze from tomorrow.
--
-- 0033 required `p_start_date >= current_date + 2` ("48 hours"), and
-- `current_date` is the database's UTC date, not the studio's. In the
-- evening (from 00:00 Bucharest until 00:00 UTC) the earliest allowed
-- start was the day after tomorrow in studio time; the rest of the day it
-- was two days out. Members could not freeze from the next day, and some
-- could while others could not, depending on the hour.
--
-- New rule (studio request, Nov 2026): the earliest member start date is
-- tomorrow in Europe/Bucharest. Admin allocations may still start today
-- (studio date). Everything else (3–14 days, allowance, overlap, plan
-- extension, cancelling bookings inside the window) is unchanged in
-- create_freeze_internal.
--
-- Keep FREEZE_MIN_NOTICE_DAYS in lib/constants.ts in sync.
-- Run after 0034_reschedule_cap_3.sql.
-- ================================================================

begin;

create or replace function public.freeze_membership(p_start_date date, p_duration_days int)
returns public.freeze_periods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_studio_today date := (now() at time zone 'Europe/Bucharest')::date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_start_date < v_studio_today + 1 then
    raise exception 'Freeze must start tomorrow or later' using errcode = 'P0001';
  end if;

  return public.create_freeze_internal(v_user_id, p_start_date, p_duration_days);
end;
$$;

revoke all on function public.freeze_membership(date, int) from public, anon;
grant execute on function public.freeze_membership(date, int) to authenticated;

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

  if p_start_date < (now() at time zone 'Europe/Bucharest')::date then
    raise exception 'Freeze cannot start in the past' using errcode = 'P0001';
  end if;

  return public.create_freeze_internal(p_user_id, p_start_date, p_duration_days);
end;
$$;

revoke all on function public.admin_freeze_membership(uuid, date, int) from public, anon;
grant execute on function public.admin_freeze_membership(uuid, date, int) to authenticated;

commit;
