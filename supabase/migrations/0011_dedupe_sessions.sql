-- 0011_dedupe_sessions.sql
--
-- Removes duplicate sessions (same date + start_at + trainer) that piled up
-- because the generator's idempotency check fell through when 2+ matching
-- rows already existed. Combined with the application-level fix in
-- app/admin/sessions/actions.ts, this prevents new duplicates from forming.
--
-- Strategy
--   - FUTURE sessions: keep the canonical row in each group (most bookings,
--     then oldest), delete the rest, but ONLY if they have zero bookings.
--     Future sessions are actionable for members, so we never silently move
--     or drop their booked sessions.
--   - PAST sessions: keep the canonical row, repoint bookings on duplicates
--     to the canonical, and delete the duplicates. Past sessions are
--     historical record only; nobody is going to show up to them. If a
--     user happens to have an 'booked' booking on both the canonical and
--     a duplicate (would violate the bookings unique partial index when
--     repointed), we drop the duplicate booking entirely rather than move
--     it.
--
-- We do NOT add a database-level unique index here. The application-level
-- check is enough, and any leftover historical duplicates with bookings
-- shouldn't block the migration.

begin;

-- ============ FUTURE DUPLICATES (safe deletion only) ============
with future_dups as (
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
using future_dups f
where s.id = f.id
  and f.rn > 1
  and s.booked_count = 0;

-- ============ PAST DUPLICATES (aggressive cleanup) ============

-- Pick a winner per past duplicate group.
create temp table past_winners on commit drop as
select
  session_date,
  start_at,
  trainer,
  (array_agg(id order by booked_count desc, created_at asc))[1] as winner_id
from public.sessions
where session_date < current_date
group by session_date, start_at, trainer
having count(*) > 1;

-- The loser sessions = every duplicate that isn't the winner of its group.
create temp table past_losers on commit drop as
select s.id as loser_id, w.winner_id
from public.sessions s
join past_winners w
  on s.session_date = w.session_date
 and s.start_at = w.start_at
 and s.trainer is not distinct from w.trainer
where s.id <> w.winner_id;

-- Repoint bookings from losers to winners where it won't violate the
-- bookings unique partial index (user_id, session_date) where status='booked'.
update public.bookings b
set session_id = l.winner_id
from past_losers l
where b.session_id = l.loser_id
  and not exists (
    select 1
    from public.bookings b2
    where b2.user_id = b.user_id
      and b2.session_id = l.winner_id
      and (b.status <> 'booked' or b2.status <> 'booked')  -- conflict only if both 'booked'
      and b.id <> b2.id
  )
  -- explicit safeguard: also skip if the user already has a 'booked' on the winner
  and not (
    b.status = 'booked'
    and exists (
      select 1
      from public.bookings b3
      where b3.user_id = b.user_id
        and b3.session_id = l.winner_id
        and b3.status = 'booked'
    )
  );

-- Anything still pointing at a loser is an unmovable duplicate — delete it.
delete from public.bookings b
using past_losers l
where b.session_id = l.loser_id;

-- Now the loser sessions have no bookings — drop them.
delete from public.sessions s
using past_losers l
where s.id = l.loser_id;

commit;
