# Google Calendar sync

The app pushes every session (time, trainer, class, occupancy and the list
of booked members) into a Google Calendar owned by the studio. It is
**one-way**: the app is the source of truth. Editing an event in Google
does nothing in the app and is overwritten on the next sync.

When the three `GOOGLE_*` env vars are missing the integration is a
no-op: booking, cancelling, rescheduling and week generation all work
exactly as before, and the sync button is hidden.

## How it works

| Piece | Where |
|---|---|
| Auth (service account JWT) and REST client | `lib/google/calendar.ts` |
| Event payload, deterministic event id, content hash | `lib/google/event-payload.ts` |
| Orchestrator (`syncSessions`, `reconcileCalendar`) | `lib/google/sync.ts` |
| Fire-and-forget hook used by booking mutations | `lib/google/schedule-sync.ts` |
| Mapping table `calendar_events` | `supabase/migrations/0018_calendar_events.sql` |
| Daily reconcile cron | `app/api/cron/calendar-sync/route.ts`, `vercel.json` |
| Admin button + error banner | `app/admin/sessions/` |

Triggers:

- every booking, cancellation and reschedule (member or admin) syncs the
  affected session(s) right after the response is sent (`after()`);
- week generation syncs every session it touched;
- the cron runs daily at 06:30 UTC and reconciles yesterday .. +21 days:
  pushes changed sessions, deletes events for deleted sessions, sweeps
  stray events tagged by the app;
- the admin button runs the same reconcile with `force`, re-pushing
  everything in the window.

Event title: `18:00 Andrei Maria, Popescu Ion (2/6) · Marina – Pilates`
(`18:00 Marina – Pilates (0/6)` when nobody is booked). Description: the
same names one per line, plus a link to `/admin/sessions`. Colour per
trainer. No attendees are invited (service accounts cannot invite).

## One-time setup

1. **Google Cloud project**
   - Open <https://console.cloud.google.com/>, create a project (e.g.
     `lasala-calendar`).
   - APIs & Services → Library → enable **Google Calendar API**.
2. **Service account**
   - IAM & Admin → Service Accounts → Create. No roles needed.
   - Open it → Keys → Add key → JSON. Download the file and keep it
     private (it is a credential).
   - From the JSON you need `client_email` and `private_key`.
3. **Dedicated calendar**
   - In Google Calendar (the studio account) → "Other calendars" → + →
     Create new calendar → name it `Lasala Sesiuni`. Use a secondary
     calendar, not the primary one, so the sync never touches personal
     events.
   - Calendar settings → **Share with specific people** → add the
     `client_email` with permission **Make changes to events**.
   - Calendar settings → **Integrate calendar** → copy the **Calendar ID**
     (looks like `abc123@group.calendar.google.com`).
4. **Env vars** (Vercel → Project → Settings → Environment Variables, and
   `.env.local` for local dev):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` = `private_key` (paste as is;
     literal `\n` sequences are fine)
   - `GOOGLE_CALENDAR_ID` = the Calendar ID
5. **Database**: run `supabase/migrations/0018_calendar_events.sql`.
6. Redeploy, open `/admin/sessions`, click **Sincronizează Google
   Calendar**. The toast reports created/updated/skipped/deleted/failed
   counts; the events should appear in the shared calendar within seconds.

Trainers then subscribe to the `Lasala Sesiuni` calendar from their own
Google accounts (share it with them read-only).

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Toast says not configured | One of the three env vars missing or the key does not contain `BEGIN PRIVATE KEY` | Check the values, redeploy |
| `403 ... forbidden` / `insufficientPermissions` | Calendar not shared with the service account, or shared read-only | Share with **Make changes to events** |
| `403 forbiddenForServiceAccounts` | Someone added attendees to the payload | Never send attendees |
| `401 invalid_grant` | Key deleted/rotated in Google Cloud, or server clock skew | Create a new key, update the env var |
| `404` / `410` on update | Event deleted by hand in Google and purged | Handled automatically: next sync re-creates it |
| `429` / `rateLimitExceeded` | Quota burst | Retried with backoff automatically; quota is 10,000 req/min, far above our ~300 events per window |
| Banner on `/admin/sessions` | `calendar_events.last_error` set for some sessions | Read the message, fix the cause, click the sync button |

Changing `GOOGLE_CALENDAR_ID` strands the events in the old calendar (the
app only touches the calendar it is configured with). Delete the old
calendar or its events by hand.

## Data protection

Member full names are pushed to Google. The GDPR document
(`assets/gdpr-ro-v1.md`) lists Google LLC as a processor for this. Phone
numbers and emails are never sent.
