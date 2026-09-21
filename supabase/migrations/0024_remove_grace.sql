-- 0024_remove_grace.sql
--
-- Historical record: applied to the live project through the SQL editor in
-- Aug 2026 (branch claude/app-features-addition-50b8ef, then numbered
-- "0017"). Removes the grace-bookings feature (0015): members with an
-- expired or exhausted plan can no longer book extra sessions.
--
-- Only the schema part is kept here. The booking-function bodies that came
-- with it (grace-free book_session / cancel_booking) are superseded by
-- 0022_queued_plans.sql and 0023_reconcile_live_schema.sql, which define the
-- final versions.
--
-- bookings.is_grace is intentionally KEPT: bookings created under the grace
-- feature never consumed sessions_used, so cancelling one must not refund a
-- session credit (cancel_booking guards on it). Once
-- `select count(*) from bookings where is_grace and status = 'booked'` is
-- permanently 0, a follow-up migration may drop the column and the guard.

alter table public.plans drop column if exists grace_used;
