-- ================================================================
-- Link generated sessions back to the schedule_template slot they came
-- from, so recurring pins (recurring_bookings.schedule_template_id) can be
-- materialised against already-existing sessions at any time — when a pin
-- is added, when a plan is approved/activated, and by the daily sync —
-- instead of only inside the week generator.
--
-- Also lets members read sessions they are booked into even before the
-- Sunday unlock: pins are now booked on Saturday, ahead of the unlock,
-- and home/history would otherwise show those bookings with a null
-- session.
-- Run after 0019_drop_profile_trainer.sql.
-- ================================================================

begin;

alter table public.sessions
  add column if not exists schedule_template_id uuid
    references public.schedule_template(id) on delete set null;

create index if not exists sessions_template_start_idx
  on public.sessions (schedule_template_id, start_at)
  where schedule_template_id is not null;

-- Backfill existing sessions from the same tuple the generator matches on:
-- studio weekday (template uses 0=Mon .. 6=Sun), hour, minute, trainer.
update public.sessions s
set schedule_template_id = t.id
from public.schedule_template t
where s.schedule_template_id is null
  and t.trainer is not distinct from s.trainer
  and (extract(isodow from (s.start_at at time zone 'Europe/Bucharest'))::int - 1)
      = t.day_of_week
  and extract(hour from (s.start_at at time zone 'Europe/Bucharest'))::int
      = t.start_hour
  and extract(minute from (s.start_at at time zone 'Europe/Bucharest'))::int
      = t.start_minute;

-- Heal unlock_at on sessions still ahead of us. `unlockAtFor` used to land
-- on the Monday a week before the session instead of the Sunday before
-- its week; recompute as Sunday 00:00 Europe/Bucharest of the prior week.
update public.sessions s
set unlock_at = (
  (date_trunc('week', s.start_at at time zone 'Europe/Bucharest') - interval '1 day')
    at time zone 'Europe/Bucharest'
)
where s.start_at > now();

drop policy if exists "members read unlocked sessions" on public.sessions;
create policy "members read unlocked sessions"
  on public.sessions for select
  using (
    unlock_at <= now()
    or exists (
      select 1 from public.bookings b
      where b.session_id = sessions.id and b.user_id = auth.uid()
    )
  );

commit;
