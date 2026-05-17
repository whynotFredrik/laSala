-- 0012_reset_sessions_weekend_off.sql
--
-- Two changes:
--   1. Nuke ALL existing sessions and bookings so the next generate run
--      produces a clean slate. Cancellations/reschedule history is part
--      of bookings, so this also clears that — fine for the current
--      pre-launch testing phase.
--   2. Remove Eugen's Saturday (5) and Sunday (6) template slots. Eugen
--      now works:
--        - Mon..Fri:  06:00, 07:00, 08:00, 09:00
--        - Tue & Thu: also 16:00, 17:00, 18:00
--
-- Marina's and Ana's templates are untouched.

begin;

-- ============ 1) Reset sessions ============

-- Delete bookings first (sessions FK is ON DELETE RESTRICT).
-- Recurring bookings (the template pins) are kept — they auto-rebook
-- the member on the next session generation.
delete from public.bookings;

-- Reset plans.sessions_used so the cleared bookings don't keep counting
-- against members' plans.
update public.plans set sessions_used = 0 where sessions_used > 0;

-- Now wipe all sessions.
delete from public.sessions;

-- ============ 2) Eugen weekends off ============

delete from public.schedule_template
where trainer = 'Eugen'
  and day_of_week in (5, 6);

commit;
