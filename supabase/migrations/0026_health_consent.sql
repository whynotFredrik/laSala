-- 0026_health_consent.sql
--
-- Historical record: applied to the live project through the SQL editor in
-- Aug 2026 (branch claude/app-features-addition-50b8ef, then numbered
-- "0020"). Sign-up requires a self-declaration that the member is medically
-- fit for physical training ("apt de sport"). Stored as a timestamp,
-- mirroring gdpr_consented_at. Nullable: accounts created before this
-- migration have no declaration on file.

alter table public.profiles
  add column if not exists health_consented_at timestamptz;
