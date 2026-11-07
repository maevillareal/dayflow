# DAYFLOW

Organize your days. Take care of yourself. Make progress at your own pace.

DAYFLOW is an installable web app (PWA) for habits, tasks, focus sessions, self care, skin care and healthy eating, with two companions: **Lei** (a Border Collie, the cheerleader) and **Tobi** (a white Persian cat, the gentle reminder). A Chrome extension blocks distracting sites during focus sessions.

Running cost: **$0**. GitHub Pages hosts the app, Supabase's free tier handles login and data, and the extension loads unpacked.

## Run it on this computer

```bash
npm install
npm run dev:demo   # demo mode: no login, data stays in this browser, sample history included
npm run dev        # real mode: needs .env.local with your Supabase keys (see below)
npm test           # unit tests for schedules, streaks, reminders, skin care and self care rules
```

Open http://localhost:5173.

## Connect login and storage (Supabase, free)

1. Create a project at supabase.com.
2. In **SQL Editor**, paste and run `supabase/migrations/0001_init.sql`. It creates the tables with Row Level Security, so every user only ever sees their own rows.
3. In **Authentication → URL Configuration**, add `http://localhost:5173` and `https://<your-github-username>.github.io/dayflow/` to the redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the **Project URL** and the **anon / publishable** key. The anon key is meant to be public. **Never** use the `service_role` key here.

## Publish on GitHub Pages (free)

1. Create a **public** repository named `dayflow` and push this folder to `main`.
2. In the repo: **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Every push to `main` runs the tests, builds, and deploys to `https://<your-github-username>.github.io/dayflow/`.
5. Open that address in Chrome or Edge and choose **Install** in the address bar to get DAYFLOW in its own window and the Start menu.

## Website blocking (Chrome extension)

1. `extension/manifest.json` already allows `https://maevillareal.github.io` and localhost. If you fork this, change that line to your own GitHub Pages address.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `extension` folder.
3. Its ID is always `llihamdjohpaehpmknhehbcnmllhfgdp` (fixed by the public key in the manifest). DAYFLOW finds it automatically. Check **Settings → Website blocking** shows *Connected*.

How it's secured:
- Only the pages listed under `externally_connectable` can talk to the extension, and it checks the sender again on every message.
- Every message is validated: domains, times, and sessions are capped at 6 hours.
- The extension never sends browsing data anywhere.
- The app shows "Blocking active" only when the extension confirms it.
- Scheduled Mode needs Chrome running with the extension enabled. Like any extension it can be switched off, so Strict Mode isn't tamper-proof.

## What's where

| Path | What |
| --- | --- |
| `src/domain/` | Pure rules plus tests: schedules (versioned), streaks, completion %, skin care conflicts, self-care dates, the reminder engine |
| `src/data/` | Types, the in-memory store, Supabase and demo (IndexedDB) storage, starter data |
| `src/features/` | One folder per page |
| `src/companions/` | Lei and Tobi (six moods), reminder card, desktop notifications |
| `extension/` | Chrome MV3 extension |
| `supabase/migrations/` | Database schema and Row Level Security |

## Known limits

- Notifications work while DAYFLOW is open, in a tab or as the installed app (even minimized). There are no reminders while it's fully closed, because that needs a push server.
- Changes need an internet connection to save. The app itself loads offline.
- Website blocking works in Chrome and Edge only.
