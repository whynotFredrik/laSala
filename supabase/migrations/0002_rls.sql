-- ================================================================
-- Row Level Security policies
-- Run after 0001_init.sql.
-- ================================================================

-- Helper: is the current auth user an admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============ Enable RLS on all tables ============

alter table public.profiles enable row level security;
alter table public.plan_tiers enable row level security;
alter table public.plans enable row level security;
alter table public.plan_requests enable row level security;
alter table public.freeze_periods enable row level security;
alter table public.classes enable row level security;
alter table public.schedule_template enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.weight_logs enable row level security;
alter table public.nutrition_logs enable row level security;
alter table public.progress_photos enable row level security;
alter table public.dietary_questionnaires enable row level security;
alter table public.gdpr_document enable row level security;
alter table public.email_log enable row level security;

-- ============ PROFILES ============

create policy "members read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "admins read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "members update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
  -- Members cannot escalate themselves to admin.

create policy "admins update any profile"
  on public.profiles for update
  using (public.is_admin());

-- ============ PLAN_TIERS ============
-- Anyone authenticated can read; only admins write.

create policy "authenticated read plan tiers"
  on public.plan_tiers for select
  to authenticated using (is_active or public.is_admin());

create policy "admins write plan tiers"
  on public.plan_tiers for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ PLANS ============

create policy "members read own plan"
  on public.plans for select
  using (user_id = auth.uid());

create policy "admins read all plans"
  on public.plans for select
  using (public.is_admin());

create policy "admins write plans"
  on public.plans for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ PLAN_REQUESTS ============

create policy "members read own requests"
  on public.plan_requests for select
  using (user_id = auth.uid());

create policy "admins read all requests"
  on public.plan_requests for select
  using (public.is_admin());

create policy "members create own request"
  on public.plan_requests for insert
  with check (user_id = auth.uid() and status = 'pending');

create policy "members cancel own pending request"
  on public.plan_requests for update
  using (user_id = auth.uid() and status = 'pending')
  with check (status = 'cancelled');

create policy "admins write any request"
  on public.plan_requests for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ FREEZE_PERIODS ============

create policy "members read own freezes"
  on public.freeze_periods for select
  using (user_id = auth.uid());

create policy "admins read all freezes"
  on public.freeze_periods for select
  using (public.is_admin());

-- Inserts go through the freeze_membership() function (security definer); deny direct.
create policy "no direct freeze inserts"
  on public.freeze_periods for insert
  with check (false);

create policy "admins write freezes"
  on public.freeze_periods for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ CLASSES ============

create policy "authenticated read classes"
  on public.classes for select
  to authenticated using (is_active or public.is_admin());

create policy "admins write classes"
  on public.classes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ SCHEDULE_TEMPLATE ============

create policy "admins read schedule template"
  on public.schedule_template for select
  using (public.is_admin());

create policy "admins write schedule template"
  on public.schedule_template for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ SESSIONS ============
-- Members see only sessions whose unlock_at has passed.

create policy "members read unlocked sessions"
  on public.sessions for select
  using (unlock_at <= now());

create policy "admins read all sessions"
  on public.sessions for select
  using (public.is_admin());

create policy "admins write sessions"
  on public.sessions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ BOOKINGS ============

create policy "members read own bookings"
  on public.bookings for select
  using (user_id = auth.uid());

create policy "admins read all bookings"
  on public.bookings for select
  using (public.is_admin());

-- All booking writes happen through SECURITY DEFINER functions; deny direct writes.
create policy "no direct booking inserts"
  on public.bookings for insert with check (false);
create policy "no direct booking updates"
  on public.bookings for update using (public.is_admin()) with check (public.is_admin());
create policy "no direct booking deletes"
  on public.bookings for delete using (public.is_admin());

-- ============ PROGRESS LOGS ============

create policy "members manage own weight logs"
  on public.weight_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins read weight logs"
  on public.weight_logs for select
  using (public.is_admin());

create policy "members manage own nutrition logs"
  on public.nutrition_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins read nutrition logs"
  on public.nutrition_logs for select
  using (public.is_admin());

create policy "members manage own progress photos"
  on public.progress_photos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins read progress photos"
  on public.progress_photos for select
  using (public.is_admin());

-- ============ DIETARY QUESTIONNAIRE ============

create policy "members manage own dietary"
  on public.dietary_questionnaires for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins read dietary"
  on public.dietary_questionnaires for select
  using (public.is_admin());

-- ============ GDPR DOCUMENT ============

create policy "anyone reads current gdpr"
  on public.gdpr_document for select
  using (is_current or public.is_admin());

create policy "admins write gdpr"
  on public.gdpr_document for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============ EMAIL LOG ============
-- Members never read this; admins only.

create policy "admins read email log"
  on public.email_log for select
  using (public.is_admin());

create policy "no direct email log writes"
  on public.email_log for insert
  with check (false);
-- Inserts come from the service role from Resend webhook handlers.

-- ============ STORAGE BUCKETS ============
-- Run from the Supabase dashboard or via migrations after creating buckets:
-- 1. Create bucket 'progress-photos' as PRIVATE.
-- 2. Create bucket 'public-assets' as PUBLIC.
-- Then add the storage RLS policies below.

-- Members can upload/read/delete their own progress photos.
-- Path convention: '<user_id>/<photo_id>.jpg'
-- (Run these after the buckets exist.)

-- create policy "members upload own progress photos"
--   on storage.objects for insert to authenticated
--   with check (
--     bucket_id = 'progress-photos'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
-- create policy "members read own progress photos"
--   on storage.objects for select to authenticated
--   using (
--     bucket_id = 'progress-photos'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
-- create policy "members delete own progress photos"
--   on storage.objects for delete to authenticated
--   using (
--     bucket_id = 'progress-photos'
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );
-- create policy "admins read any progress photo"
--   on storage.objects for select to authenticated
--   using (bucket_id = 'progress-photos' and public.is_admin());
