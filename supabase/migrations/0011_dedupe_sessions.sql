-- 0011_dedupe_sessions.sql
--
-- Two fixes:
--   1. Dedupe any existing duplicate sessions (same date + start_at + trainer)
--      that piled up because the generator's idempotency check fell through
--      when 2+ matching rows already existed.
--   2. Strengthen the unique constraints so this can't happen again:
--      - For trainer-assigned sessions, the existing
--        sessions_unique_slot (session_date, start_at, trainer) already
--        works — Postgres treats trainer values as distinct.
--      - For unassigned (trainer = null) sessions, add a separate partial
--        unique index since NULL != NULL by default in Postgres uniques.

begin;

-- 1) Dedupe. In each (date, start_at, trainer) group keep the row with the
--    most bookings (so we never orphan a booking), then by oldest created_at
--    as tiebreaker. Delete the rest, but only the ones with zero bookings —
--    we never want to violate the bookings FK or drop the rug under members.
with ranked as (
  select
    id,
    booked_count,
    row_number() over (
      partition by session_date, start_at, trainer
      order by booked_count desc, created_at asc
    ) as rn
  from public.sessions
  where session_date >= current_date
)
delete from public.sessions s
using ranked r
where s.id = r.id
  and r.rn > 1
  and s.booked_count = 0;

-- 2) Tighten the unique index so null-trainer duplicates can't be created.
--    We keep the original sessions_unique_slot (covers non-null trainers
--    via DISTINCT semantics) and add a second partial unique that covers
--    the trainer-is-null case.
create unique index if not exists sessions_unique_slot_null_trainer
  on public.sessions (session_date, start_at)
  where trainer is null;

commit;
