# Backup & Restore — Lasala Fitness Studio

Covers: how database backups work, how to do an extra manual export, how to
restore from a backup, what's *not* backed up automatically, and what to do
when you suspect data loss.

---

## TL;DR

- **Postgres data**: Supabase takes a daily automated backup. Free tier
  retains **7 days**; Pro tier retains **30 days** plus point-in-time
  recovery (PITR) at any second within the retention window.
- **Storage (progress photos)**: not included in Postgres backups. Treat
  separately — see [Storage backups](#storage-backups) below.
- **Auth users**: included in Supabase's automated backups (the `auth.users`
  table is part of the same Postgres instance).
- **Source code**: GitHub. Vercel rebuilds from a commit; no separate
  source backup needed.
- **Email logs**: in the `email_log` Postgres table — covered by the
  database backup.

---

## 1. Daily database backups (automatic)

Supabase backs up the Postgres database every 24 hours.

- **Where**: Supabase dashboard → your project → **Database → Backups**.
- **Retention**:
  - Free tier: 7 daily backups.
  - Pro tier: 30 daily backups + PITR (any second within 7 days).
- **Cost of upgrade**: Pro is the only way to get PITR. Worth it before
  launch — a single hour of bookings lost from rolling back to last
  midnight is a real customer-trust hit.

**You don't need to do anything for these to happen.** Verify they exist
once a week by glancing at the Backups tab.

## 2. Manual export (recommended monthly)

A second copy outside Supabase guards against the (unlikely) scenario of
losing access to the project entirely.

**From the dashboard:**

1. Supabase → **Database → Backups → Download** the most recent backup.
2. The file is a `pg_dump`-compatible `.sql` file.
3. Store in a secure offline location (e.g. an encrypted folder on a
   personal drive, or a private Backblaze B2 / S3 bucket).
4. Keep the **last 3 monthly exports**; rotate older ones.

**From the CLI** (alternative):

```bash
pnpm supabase db dump \
  --project-ref bnlcmgwxzfjwqhwefzqt \
  --schema public,auth \
  -f backups/lasala-$(date +%Y-%m-%d).sql
```

You'll be prompted for the database password (Supabase → Settings →
Database).

## 3. Storage backups

The `progress-photos` Supabase Storage bucket holds member-uploaded photos.
Postgres backups do **not** include it — only the `progress_photos` table
rows that reference the storage paths.

**For v1 we accept the risk** that storage is the single point of failure
for photos. Members can re-upload if needed; nothing critical to operations
is lost. If/when this grows to "would be a real loss":

```bash
# Supabase CLI — download every object in the bucket
pnpm supabase storage cp \
  --recursive \
  ss:///progress-photos ./backups/storage-$(date +%Y-%m-%d)/
```

(Verify the exact CLI syntax against current Supabase CLI docs — the
storage subcommand has changed across versions.)

## 4. Restore — full database

**Use this when:** the production database is corrupted, accidentally
truncated, or otherwise unrecoverable. Plan to be down for ~5–15 minutes.

1. **Notify members** via email/social that the system is down for
   maintenance. Tell them not to attempt to book, log in, or modify data
   while the restore is happening.
2. Supabase dashboard → **Database → Backups**.
3. Pick the backup point (or specific timestamp on PITR).
4. Click **Restore** → confirm. Supabase replaces the live database with
   the snapshot.
5. Wait for the green check.
6. Smoke test:
   - Sign in as the studio admin account at `/admin`.
   - Confirm the dashboard counts look reasonable.
   - Open `/admin/users` and confirm a known member is listed.
   - Open `/admin/sessions` and confirm session rows are present.
7. Notify members that the system is back up.

## 5. Restore — single table or row

**Use this when:** an admin (or a bug) deletes specific data — e.g. a
member is accidentally removed, or a plan is wrongly cancelled.

PITR makes this surgical: you can spin up a temporary clone at the moment
*before* the deletion, copy the rows out, then restore them into
production.

1. Supabase → **Database → Backups → PITR**. Pick the timestamp just
   before the bad change.
2. Choose **"Restore to a new project"** (do **not** restore in place — that
   would also roll back every legitimate change made since the deletion).
3. Wait for the new project to spin up (~3–5 min).
4. Connect to the temp project (Settings → Database → connection string).
5. Find the missing rows: e.g.
   ```sql
   select * from public.profiles where id = 'the-uuid-that-was-deleted';
   ```
6. Copy them. Paste into production via the SQL editor.
7. Delete the temp project.

## 6. Restore — auth users only

The `auth.users` table is in the same backup as `public.*`. If only an auth
user is lost (rare), the same PITR-to-temp-project pattern works. Don't try
to insert rows into `auth.users` manually — Supabase manages encryption and
metadata fields. Use the dashboard's **Authentication → Users → Add user**
or the admin API.

## 7. Local development & test data

Local dev points at the same Supabase project as production by default.
This is fine for two-person teams but risky for any data-mutating
experiment. To isolate:

1. Supabase → **Create new project** → name it "lasala-dev".
2. Run the same migrations + seed.
3. Update your `.env.local` with the new project's URL + keys.
4. Production stays untouched.

## 8. What's *not* backed up

- **`.env.local`** — your secrets. Keep a copy in a personal password
  manager (1Password, Bitwarden). Vercel env vars also serve as a copy.
- **Resend templates** (currently inline in `lib/email/templates.ts` —
  covered by Git).
- **PWA icons** in `public/`.

## 9. Disaster contact list

If something serious happens (data loss, suspected breach, prolonged
outage):

- **Supabase support**: support@supabase.com (Pro tier gets faster
  response)
- **Vercel support**: vercel.com/help (Hobby tier is community; Pro
  tier gets email)
- **Resend support**: resend.com/contact
- **ANSPDCP** (in case of personal data breach): plangeri@dataprotection.ro
  — by law, breaches affecting personal data must be reported within
  **72 hours**.

## 10. Test the restore at least once

You don't have a backup if you've never restored from one. Once a quarter:

1. Pick the most recent automatic backup.
2. Restore to a *temporary* project (not production).
3. Open it, sign in, browse a few admin pages.
4. Confirm everything is intact.
5. Delete the temp project.

This drill takes ~15 minutes and catches "the backup was corrupt" surprises
*before* you need them in anger.

---

**Last reviewed:** _[REVIZUIRE — update on first restore drill, then
quarterly]_
