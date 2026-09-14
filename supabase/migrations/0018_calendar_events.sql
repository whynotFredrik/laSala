-- ================================================================
-- Google Calendar sync (app -> calendar, one way).
--
-- Every session the app knows about is mirrored as an event in the
-- studio's Google Calendar. This table maps a session to the Google event
-- we created for it, keeps a content hash so unchanged events are not
-- re-pushed, and records the last sync error for the admin UI.
--
-- `session_id` is `on delete set null` on purpose: reseed migrations
-- (0012, 0014) delete sessions outright, and we want the orphaned row to
-- survive so the reconcile job can delete the stale Google event.
--
-- Run after 0017_book_session_for_service_role.sql.
-- ================================================================

begin;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete set null,
  google_calendar_id text not null,
  google_event_id text not null,
  html_link text,
  content_hash text,
  synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (google_calendar_id, google_event_id)
);

create unique index if not exists calendar_events_session_uidx
  on public.calendar_events (session_id, google_calendar_id)
  where session_id is not null;

create index if not exists calendar_events_orphan_idx
  on public.calendar_events (google_calendar_id)
  where session_id is null;

alter table public.calendar_events enable row level security;

drop policy if exists "admins read calendar events" on public.calendar_events;
create policy "admins read calendar events"
  on public.calendar_events for select
  using (public.is_admin());

-- No insert/update/delete policies: only the service role (server-only
-- sync module + cron) writes here. Same pattern as email_log.

commit;
