-- ================================================================
-- Add first_name, sex, trainer columns to profiles.
-- Drop the old tdee_sex column — `sex` is canonical from sign-up
-- and reused by the TDEE calculator.
-- Update handle_new_user trigger to populate new fields from auth metadata.
-- Run after 0003_functions.sql.
-- ================================================================

-- New columns
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists sex text check (sex in ('male', 'female')),
  add column if not exists trainer text
    check (trainer in ('Eugen', 'Marina', 'Ana'));

-- Backfill sex from tdee_sex for any existing rows
update public.profiles
set sex = tdee_sex
where tdee_sex is not null and sex is null;

-- Drop the now-redundant tdee_sex column
alter table public.profiles drop column if exists tdee_sex;

-- Indexes for the trainer round-robin lookups in the sign-up action
create index if not exists profiles_trainer_idx on public.profiles (trainer);
create index if not exists profiles_sex_trainer_idx on public.profiles (sex, trainer);

-- Updated trigger: read first_name + sex from auth.users.raw_user_meta_data
-- (the sign-up server action passes these in `options.data` to signUp).
-- Trainer is assigned by the server action right after, since it requires
-- a query against the existing population to balance Marina/Ana.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, first_name, sex)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'first_name', null),
    new.raw_user_meta_data->>'sex'
  );
  return new;
end;
$$;
