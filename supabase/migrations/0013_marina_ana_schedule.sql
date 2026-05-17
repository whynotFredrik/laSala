-- 0013_marina_ana_schedule.sql
--
-- Sets Marina's and Ana's schedules. Both run identical, parallel slots
-- (each member is assigned to one of them, so two simultaneous sessions
-- at the same time is fine — the per-trainer uniqueness allows it).
--
-- Schedule
--   - Mon, Wed, Fri:  06:00, 07:00, 08:00, 09:00, 10:00  (last 10-11)
--   - Tue, Thu:       09:00, 10:00                         (last 10-11)
--   - Mon..Fri:       16:00, 17:00, 18:00, 19:00          (last 19-20)
--
-- All slots are 60 minutes, default capacity 6. Saturday and Sunday off.
-- Eugen's slots from 0012 are untouched.

begin;

-- 1) Wipe Marina's and Ana's existing template rows so we reseed cleanly.
delete from public.schedule_template where trainer in ('Marina', 'Ana');

-- 2) Insert the same schedule for both trainers via cross join.
with trainers as (
  select unnest(array['Marina', 'Ana']::text[]) as t
),
slots as (
  -- Morning: Mon (0), Wed (2), Fri (4) at 06..10
  select dow, hr
  from unnest(array[0, 2, 4]) as dow
  cross join unnest(array[6, 7, 8, 9, 10]) as hr

  union all

  -- Morning: Tue (1), Thu (3) at 09..10
  select dow, hr
  from unnest(array[1, 3]) as dow
  cross join unnest(array[9, 10]) as hr

  union all

  -- Afternoon: Mon..Fri at 16..19
  select dow, hr
  from unnest(array[0, 1, 2, 3, 4]) as dow
  cross join unnest(array[16, 17, 18, 19]) as hr
)
insert into public.schedule_template
  (day_of_week, start_hour, start_minute, duration_min, capacity, trainer, is_enabled)
select s.dow, s.hr, 0, 60, 6, t.t, true
from trainers t
cross join slots s;

commit;
