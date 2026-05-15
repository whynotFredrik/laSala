-- ================================================================
-- Sign-up now collects age + height. The trigger pulls both from
-- raw_user_meta_data and stores them in the existing tdee_age /
-- tdee_height_cm columns (those columns are the canonical fields for
-- "user's age / height" now — also reused by the TDEE calculator).
-- Run after 0008_recurring_bookings.sql.
-- ================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id, email, full_name, first_name, sex,
    tdee_age, tdee_height_cm
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'first_name', null),
    new.raw_user_meta_data->>'sex',
    nullif(new.raw_user_meta_data->>'age', '')::int,
    nullif(new.raw_user_meta_data->>'height_cm', '')::numeric
  );
  return new;
end;
$$;
