-- ================================================================
-- Change history (admin "Istoric" page).
--
-- Every change to bookings, the weekly schedule, recurring pins, plans,
-- plan requests and freezes is recorded by triggers, so nothing slips
-- through regardless of the path (member RPC, admin action, daily sync).
--
-- Who did it (`actor_id`):
--   * a signed-in request → auth.uid() (member or admin);
--   * a service-role request → the `x-actor-id` header the app sets on
--     its service client for admin actions (see lib/supabase/service.ts);
--     trusted only for the service role;
--   * otherwise null = automatic (cron / daily sync).
--
-- `details` keeps a snapshot (session time, trainer, slot, tier...) so
-- entries stay readable after the referenced rows change or disappear.
-- Run after 0030_daily_agenda_recipients.sql.
-- ================================================================

begin;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  tx bigint not null default txid_current(),
  actor_id uuid references public.profiles(id) on delete set null,
  member_id uuid references public.profiles(id) on delete cascade,
  entity text not null check (
    entity in ('booking', 'schedule_slot', 'recurring', 'plan', 'plan_request', 'freeze')
  ),
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_created_idx
  on public.audit_log (created_at desc);
create index if not exists audit_log_member_idx
  on public.audit_log (member_id, created_at desc);
create index if not exists audit_log_tx_idx
  on public.audit_log (tx);

alter table public.audit_log enable row level security;

-- Read-only for admins; rows are written by the security-definer
-- triggers below only.
drop policy if exists "admins read audit log" on public.audit_log;
create policy "admins read audit log"
  on public.audit_log for select
  using (public.is_admin());

-- ============ helpers ============

create or replace function public.audit_actor()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_header text;
begin
  if v_uid is not null then
    return v_uid;
  end if;
  v_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  );
  if v_role <> 'service_role' then
    return null;
  end if;
  v_header := nullif(current_setting('request.headers', true), '')::json ->> 'x-actor-id';
  if v_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_header::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.audit_write(
  p_member_id uuid,
  p_entity text,
  p_entity_id uuid,
  p_action text,
  p_details jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_log (actor_id, member_id, entity, entity_id, action, details)
  select a, m, p_entity, p_entity_id, p_action, coalesce(p_details, '{}'::jsonb)
  -- Both must still exist as profiles (FK). The member may not when the
  -- write is a cascade from deleting their account — record it unlinked
  -- instead of failing the delete.
  from (
    select
      (select id from public.profiles where id = public.audit_actor()) as a,
      (select id from public.profiles where id = p_member_id) as m
  ) x;
$$;

revoke all on function public.audit_write(uuid, text, uuid, text, jsonb) from public;

create or replace function public.audit_session_snapshot(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('start_at', s.start_at, 'trainer', s.trainer)
  from public.sessions s
  where s.id = p_session_id;
$$;

create or replace function public.audit_slot_snapshot(p_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'day_of_week', t.day_of_week,
    'start_hour', t.start_hour,
    'start_minute', t.start_minute,
    'trainer', t.trainer
  )
  from public.schedule_template t
  where t.id = p_template_id;
$$;

-- ============ bookings ============

create or replace function public.audit_bookings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.user_id, 'booking', new.id, 'booked',
      jsonb_build_object('session', public.audit_session_snapshot(new.session_id)));
  elsif new.session_id <> old.session_id then
    perform public.audit_write(new.user_id, 'booking', new.id, 'moved',
      jsonb_build_object(
        'from', public.audit_session_snapshot(old.session_id),
        'to', public.audit_session_snapshot(new.session_id)));
  elsif new.status <> old.status then
    perform public.audit_write(new.user_id, 'booking', new.id,
      case when new.status = 'cancelled' then 'cancelled' else 'status_changed' end,
      jsonb_build_object(
        'session', public.audit_session_snapshot(new.session_id),
        'from_status', old.status,
        'to_status', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_audit on public.bookings;
create trigger bookings_audit
  after insert or update of status, session_id on public.bookings
  for each row execute function public.audit_bookings();

-- ============ schedule template ============

create or replace function public.audit_schedule_template()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(null, 'schedule_slot', new.id, 'created',
      jsonb_build_object('new', to_jsonb(new) - 'id'));
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'id') = (to_jsonb(old) - 'id') then
      return new;
    end if;
    perform public.audit_write(null, 'schedule_slot', new.id, 'updated',
      jsonb_build_object('old', to_jsonb(old) - 'id', 'new', to_jsonb(new) - 'id'));
  else
    perform public.audit_write(null, 'schedule_slot', old.id, 'deleted',
      jsonb_build_object('old', to_jsonb(old) - 'id'));
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists schedule_template_audit on public.schedule_template;
create trigger schedule_template_audit
  after insert or update or delete on public.schedule_template
  for each row execute function public.audit_schedule_template();

-- ============ recurring pins ============

create or replace function public.audit_recurring_bookings()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(new.user_id, 'recurring', new.id, 'created',
      jsonb_build_object('slot', public.audit_slot_snapshot(new.schedule_template_id)));
  elsif tg_op = 'UPDATE' then
    if old.is_active and not new.is_active then
      perform public.audit_write(new.user_id, 'recurring', new.id, 'removed',
        jsonb_build_object('slot', public.audit_slot_snapshot(new.schedule_template_id)));
    elsif not old.is_active and new.is_active then
      perform public.audit_write(new.user_id, 'recurring', new.id, 'created',
        jsonb_build_object('slot', public.audit_slot_snapshot(new.schedule_template_id)));
    end if;
  elsif old.is_active then
    perform public.audit_write(old.user_id, 'recurring', old.id, 'removed',
      jsonb_build_object('slot', public.audit_slot_snapshot(old.schedule_template_id)));
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists recurring_bookings_audit on public.recurring_bookings;
create trigger recurring_bookings_audit
  after insert or update or delete on public.recurring_bookings
  for each row execute function public.audit_recurring_bookings();

-- ============ plans ============

create or replace function public.audit_plans()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier text;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_changes jsonb := '{}'::jsonb;
begin
  select name_ro into v_tier from public.plan_tiers where id = new.tier_id;

  if tg_op = 'INSERT' then
    perform public.audit_write(new.user_id, 'plan', new.id, 'created',
      jsonb_build_object(
        'tier', v_tier,
        'sessions_total', new.sessions_total,
        'sessions_used', new.sessions_used,
        'start_date', new.start_date,
        'end_date', new.end_date,
        'status', new.status));
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);
  for v_key in select jsonb_object_keys(v_new) loop
    if v_key not in ('id', 'created_at') and v_new -> v_key is distinct from v_old -> v_key then
      v_changes := v_changes || jsonb_build_object(
        v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
    end if;
  end loop;

  if v_changes = '{}'::jsonb then
    return new;
  end if;

  -- A booking / cancellation moves `sessions_used` in the same
  -- transaction; the booking entry already tells that story.
  if (select array_agg(k) from jsonb_object_keys(v_changes) k) = array['sessions_used']
     and exists (
       select 1 from public.audit_log
       where tx = txid_current() and entity = 'booking'
     ) then
    return new;
  end if;

  perform public.audit_write(new.user_id, 'plan', new.id, 'updated',
    jsonb_build_object('tier', v_tier, 'changes', v_changes));
  return new;
end;
$$;

drop trigger if exists plans_audit on public.plans;
create trigger plans_audit
  after insert or update on public.plans
  for each row execute function public.audit_plans();

-- ============ plan requests ============

create or replace function public.audit_plan_requests()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier text;
begin
  select name_ro into v_tier from public.plan_tiers where id = new.tier_id;
  if tg_op = 'INSERT' then
    perform public.audit_write(new.user_id, 'plan_request', new.id, 'requested',
      jsonb_build_object('tier', v_tier));
  elsif new.status <> old.status then
    perform public.audit_write(new.user_id, 'plan_request', new.id, new.status::text,
      jsonb_build_object('tier', v_tier, 'reason', new.rejection_reason));
  end if;
  return new;
end;
$$;

drop trigger if exists plan_requests_audit on public.plan_requests;
create trigger plan_requests_audit
  after insert or update on public.plan_requests
  for each row execute function public.audit_plan_requests();

-- ============ freezes ============

create or replace function public.audit_freeze_periods()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.freeze_periods := coalesce(new, old);
begin
  if tg_op = 'UPDATE'
     and new.start_date = old.start_date and new.end_date = old.end_date then
    return new;
  end if;
  perform public.audit_write(v_row.user_id, 'freeze', v_row.id,
    case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    jsonb_build_object(
      'start_date', v_row.start_date,
      'end_date', v_row.end_date,
      'duration_days', v_row.duration_days));
  return v_row;
end;
$$;

drop trigger if exists freeze_periods_audit on public.freeze_periods;
create trigger freeze_periods_audit
  after insert or update or delete on public.freeze_periods
  for each row execute function public.audit_freeze_periods();

commit;
