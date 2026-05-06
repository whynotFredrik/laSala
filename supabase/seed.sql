-- ================================================================
-- Seed data
-- Idempotent: uses ON CONFLICT so re-running is safe.
-- Run in Supabase SQL editor after the three migrations.
-- ================================================================

-- ============ PLAN TIERS (prices in RON) ============

insert into public.plan_tiers (code, name_ro, name_en, category, sessions_per_month, duration_months, price_ron, display_order)
values
  ('8',         '8 Sesiuni/lună',         '8 Sessions/month',          'monthly',  8,  1, 200, 10),
  ('12',        '12 Sesiuni/lună',        '12 Sessions/month',         'monthly', 12,  1, 300, 20),
  ('16',        '16 Sesiuni/lună',        '16 Sessions/month',         'monthly', 16,  1, 400, 30),
  ('20',        '20 Sesiuni/lună',        '20 Sessions/month',         'monthly', 20,  1, 500, 40),
  ('6m_8',      'Promo 6 Luni - 8/lună',  '6 Months Promo - 8/month',  'promo_6m', 8,  6,1000,110),
  ('6m_12',     'Promo 6 Luni - 12/lună', '6 Months Promo - 12/month', 'promo_6m',12,  6,1500,120),
  ('6m_16',     'Promo 6 Luni - 16/lună', '6 Months Promo - 16/month', 'promo_6m',16,  6,2000,130),
  ('6m_20',     'Promo 6 Luni - 20/lună', '6 Months Promo - 20/month', 'promo_6m',20,  6,2500,140)
on conflict (code) do nothing;

-- ============ DEFAULT CLASS ============

insert into public.classes (name_ro, name_en, description_ro, description_en, default_duration_min, color)
values (
  'The Class',
  'The Class',
  'Antrenament în grup, intensitate moderată-ridicată.',
  'Group training, moderate-to-high intensity.',
  60,
  '#EF4444'
)
on conflict do nothing;

-- ============ SCHEDULE TEMPLATE (Mon/Wed/Fri) ============
-- Uses the single class created above. Adjust capacity as needed.

with c as (select id from public.classes order by created_at asc limit 1)
insert into public.schedule_template (day_of_week, start_hour, capacity, class_id)
select dow, h, 6, c.id
from c, (values
  -- Monday (0)
  (0, 6), (0, 7), (0, 8), (0, 9),
  (0, 16), (0, 17), (0, 18), (0, 19),
  -- Wednesday (2)
  (2, 6), (2, 7), (2, 8), (2, 9),
  (2, 16), (2, 17), (2, 18), (2, 19),
  -- Friday (4)
  (4, 6), (4, 7), (4, 8), (4, 9),
  (4, 16), (4, 17), (4, 18), (4, 19)
) as slots(dow, h)
on conflict do nothing;

-- ============ GDPR DOCUMENT (placeholder; replace from assets/gdpr-ro.md) ============

insert into public.gdpr_document (version, body_md, is_current)
values ('1.0-2026-02', 'PLACEHOLDER. Replace this body with the contents of assets/gdpr-ro.md before launch.', true)
on conflict (version) do nothing;
