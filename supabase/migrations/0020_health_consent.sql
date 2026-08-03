-- 0020_health_consent.sql
--
-- Sign-up now requires a self-declaration that the member is medically fit
-- for physical training ("apt de sport"). Stored as a timestamp, mirroring
-- gdpr_consented_at. Nullable: accounts created before this migration have
-- no declaration on file.
--
-- Run after 0019_admin_grant_plan.sql.

alter table public.profiles
  add column if not exists health_consented_at timestamptz;
