-- ================================================================
-- Members are no longer assigned to a trainer. Which sessions a member
-- can see and book is derived from `profiles.sex` alone (men → Eugen,
-- women → Marina + Ana, see `trainersForSex` in lib/constants.ts).
--
-- Drops `profiles.trainer` and its indexes. `sessions.trainer` and
-- `schedule_template.trainer` stay — those describe who runs the slot.
-- Run after 0018_calendar_events.sql.
-- ================================================================

begin;

drop index if exists public.profiles_trainer_idx;
drop index if exists public.profiles_sex_trainer_idx;

alter table public.profiles drop column if exists trainer;

create index if not exists profiles_sex_idx on public.profiles (sex);

commit;
