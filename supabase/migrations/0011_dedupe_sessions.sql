-- 0011_dedupe_sessions.sql
--
-- Removes duplicate sessions (same date + start_at + trainer) that piled up
-- because the generator's idempotency check fell through when 2+ matching
-- rows already existed. Combined with the application-level fix in
-- app/admin/sessions/actions.ts, this prevents new duplicates from forming.
--
-- Strategy
--   - FUTURE sessions: keep the canonical row per group (most bookings, then
--     oldest), delete the rest, but ONLY if they have zero bookings.
--     Future sessions are actionable for members; never silently drop a
--     booked one.
--   - PAST sessions: keep the canonical, repoint bookings on duplicates to
--     the canonical, drop any bookings that can't be repointed without
--     violating the bookings unique partial index, then delete the loser
--     sessions. Past sessions are historical record only.
--
-- Implementation note: avoids temp tables because the Supabase SQL editor
-- doesn't reliably keep them alive across statements. Everything is done
-- via inline CTEs.

begin;

-- ============ FUTURE DUPLICATES (safe deletion only) ============
with future_dups as (
  select
    id,
    row_number() over (
      partition by session_date, start_at, trainer
      order by booked_count desc, created_at asc
    ) as rn
  from public.sessions
  where session_date >= current_date
)
delete from public.sessions s
using future_dups f
where s.id = f.id
  and f.rn > 1
  and s.booked_count = 0;

-- ============ PAST DUPLICATES (aggressive cleanup) ============

-- Step 1: repoint bookings from loser sessions to the winner of each group,
-- but only where doing so wouldn't violate the bookings (user_id, session_date)
-- where status='booked' unique partial index.
with ranked as (
  select
    id,
    session_date,
    start_at,
    trainer,
    row_number() over (
      partition by session_date, start_at, trainer
      order by booked_count desc, created_at asc
    ) as rn
  from public.sessions
  where session_date < current_date
),
winners as (
  select id as winner_id, session_date, start_at, trainer
  from ranked where rn = 1
),
losers as (
  select
    r.id as loser_id,
    w.winner_id
  from ranked r
  join winners w
    on r.session_date = w.session_date
   and r.start_at = w.start_at
   and r.trainer is not distinct from w.trainer
  where r.rn > 1
)
update public.bookings b
set session_id = l.winner_id
from losers l
where b.session_id = l.loser_id
  and not (
    -- Skip move if user already has a 'booked' on the winner and this one
    -- is also 'booked' — moving would violate the unique partial index.
    b.status = 'booked'
    and exists (
      select 1
      from public.bookings b2
      where b2.user_id = b.user_id
        and b2.session_id = l.winner_id
        and b2.status = 'booked'
    )
  );

-- Step 2: anything still on a loser session is an unmovable duplicate —
-- delete it. Recompute the loser set inline because the previous CTE is gone.
with ranked as (
  select
    id,
    session_date,
    start_at,
    trainer,
    row_number() over (
      partition by session_date, start_at, trainer
      order by booked_count desc, created_at asc
    ) as rn
  from public.sessions
  where session_date < current_date
)
delete from public.bookings b
using ranked r
where b.session_id = r.id
  and r.rn > 1;

-- Step 3: loser sessions now have no bookings — drop them.
with ranked as (
  select
    id,
    row_number() over (
      partition by session_date, start_at, trainer
      order by booked_count desc, created_at asc
    ) as rn
  from public.sessions
  where session_date < current_date
)
delete from public.sessions s
using ranked r
where s.id = r.id
  and r.rn > 1;

commit;
