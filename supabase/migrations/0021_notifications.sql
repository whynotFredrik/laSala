-- ================================================================
-- In-app notification inbox. One row per message shown to a member
-- (weekly recurring summary, renewal reminders, plan queued/activated,
-- expiry warnings). Emails for the same events go through
-- lib/notifications/notify.ts, which inserts here first and uses the
-- (user_id, dedupe_key) uniqueness as the single dedupe for both channels.
-- Run after 0020_sessions_template_link.sql.
-- ================================================================

begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'plan_queued' | 'plan_activated' | 'renewal_reminder' | 'weekly_summary'
  -- | 'pins_booked' | 'expiration_warning'
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  -- e.g. 'renewal:<plan_id>:<remaining>', 'weekly_summary:<week_start>'.
  -- NULL never conflicts, so one-off messages just leave it empty.
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "members read own notifications"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

-- Members may only flip read_at on their own rows (column grant below).
create policy "members mark own notifications read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins insert notifications"
  on public.notifications for insert
  with check (public.is_admin());

-- No delete policy. Cron routes and server actions insert with the
-- service role, which bypasses RLS.

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

commit;
