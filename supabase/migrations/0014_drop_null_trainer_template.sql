-- 0014_drop_null_trainer_template.sql
--
-- The original seed.sql inserted schedule_template rows for Mon/Wed/Fri
-- with `trainer = null`. Migrations 0010 and 0013 added per-trainer rows
-- (Eugen, Marina, Ana) on top, but left the null-trainer rows in place.
--
-- That meant the generator produced both a null-trainer session AND a
-- per-trainer session for the same (date, time). The book page's filter
-- (`trainer.eq.<mine> OR trainer.is.null`) shows BOTH to members, so
-- every Mon/Wed/Fri slot displayed as a duplicate.
--
-- Fix: remove every template row with no trainer, then nuke sessions and
-- recurring bookings so the next generate run produces a clean state.

begin;

-- 1) Drop null-trainer template rows.
delete from public.schedule_template where trainer is null;

-- 2) Same reset dance as 0012 — wipe sessions so the next generate run
--    builds them fresh from the now-clean template. Recurring pins kept;
--    they'll re-book on regeneration.
delete from public.bookings;
update public.plans set sessions_used = 0 where sessions_used > 0;
delete from public.sessions;

commit;
