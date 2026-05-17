-- 0010_eugen_schedule.sql
--
-- Sets Eugen's weekly schedule:
--   - Every day:  06:00, 07:00, 08:00, 09:00  (last session is 09–10)
--   - Tue & Thu:  also 16:00, 17:00, 18:00    (last session is 18–19)
--
-- All slots are 60 minutes, default capacity 6 (adjust per-slot from the
-- admin UI if Eugen wants different group sizes).
--
-- Marina's and Ana's slots are untouched.

begin;

-- 1) Wipe Eugen's existing template rows so we can reseed cleanly.
delete from public.schedule_template where trainer = 'Eugen';

-- 2) Morning block: every day, hours 6..9.
insert into public.schedule_template
  (day_of_week, start_hour, start_minute, duration_min, capacity, trainer, is_enabled)
select dow, hr, 0, 60, 6, 'Eugen', true
from generate_series(0, 6) as dow
cross join unnest(array[6, 7, 8, 9]) as hr;

-- 3) Afternoon block: Tuesday (1) and Thursday (3), hours 16..18.
insert into public.schedule_template
  (day_of_week, start_hour, start_minute, duration_min, capacity, trainer, is_enabled)
select dow, hr, 0, 60, 6, 'Eugen', true
from unnest(array[1, 3]) as dow
cross join unnest(array[16, 17, 18]) as hr;

-- 4) Clean up future sessions for Eugen that nobody has booked yet so the
--    next generate run recreates them from the new template. Already-booked
--    sessions are preserved — admin can move those bookings manually if a
--    slot no longer exists in the new schedule.
delete from public.sessions
where trainer = 'Eugen'
  and session_date >= current_date
  and booked_count = 0;

commit;
