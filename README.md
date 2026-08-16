# Circles Help

Telegram bot + Mini App for the Circles Help channel. This repository is a Next.js App Router app, ready to deploy on Vercel.

The Mini App UI, Strava OAuth, Telegram/Strava webhooks, and server APIs will live in this same project. PostgreSQL stays on Supabase; the browser never talks to the database directly.

## Stack

- Next.js 16 (App Router) on Vercel
- TypeScript
- CSS Modules
- TypeORM + PostgreSQL on Supabase

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` when you start adding secrets. Do not commit real tokens.

Database schema is managed with TypeORM. See [docs/migrations.md](docs/migrations.md) to create and apply migrations against Supabase.

## Deploy on Vercel

This repo includes `vercel.json` so Vercel uses the **Next.js** framework, not a static `public` folder.

1. Import this GitHub repository at [vercel.com/new](https://vercel.com/new).
2. In Project Settings → Build and Deployment:
   - Framework Preset: **Next.js**
   - Build Command: `next build` (or leave the default)
   - Output Directory: leave empty — **do not set `public`**
3. Add environment variables from `.env.example` when they exist.
4. Deploy.

If you already created the project with Output Directory `public`, turn that override off and redeploy. Next.js writes to `.next`; Vercel serves that itself. A `public/` folder would only hold static assets, not the app build.

Hobby is enough for OAuth callbacks and webhooks. Do not use long polling or long-running workers on Vercel.

## Strava webhook

Callback URL (after deploy):

```text
https://<your-vercel-domain>/api/strava/webhook
```

- `GET` confirms a subscription: checks `hub.verify_token` against `STRAVA_WEBHOOK_VERIFY_TOKEN` and echoes `hub.challenge`.
- `POST` receives activity/athlete events. For **activity create** and **activity update**, the server loads `GET /api/v3/activities/{id}` with that athlete’s stored tokens and upserts the row if title or description matches the same phrases as admin sync (`kruzh`, `circles`, `evgeny istyukov`, `serge akhlebinin`). An update that no longer matches is removed. Activity **delete** removes the row. Athlete events (including revoke) are ignored for now.

Create the subscription (one per Strava app) after the app is live:

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id="$STRAVA_CLIENT_ID" \
  -F client_secret="$STRAVA_CLIENT_SECRET" \
  -F callback_url="https://<your-vercel-domain>/api/strava/webhook" \
  -F verify_token="$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

See [Strava webhooks](https://developers.strava.com/docs/webhooks/).

## Strava OAuth

**Link Strava** sends Telegram `initData` to `POST /api/strava/oauth/start`, then redirects to Strava. After the user authorizes, Strava returns to:

```text
https://<your-vercel-domain>/api/strava/oauth/callback
```

The callback exchanges the code, encrypts tokens, and inserts or updates the `users` row keyed by Telegram user id. On success it sets a short-lived session cookie and redirects to `/stats`.

The home page calls `GET /api/me` with Telegram `initData`. If a linked user exists, **Link Strava** is replaced by **My Stats**, which opens `/stats`. That page calls `GET /api/athlete`, which uses the stored tokens to request Strava `GET /api/v3/athlete` and shows `firstname`, `lastname`, and `profile`.

In the [Strava API settings](https://www.strava.com/settings/api), set **Authorization Callback Domain** to the Vercel host only (`your-app.vercel.app`, no `https://` and no path). Set `STRAVA_OAUTH_REDIRECT_URI` to the full callback URL above.

`TOKEN_ENCRYPTION_KEY` should be a long secret (64-char hex is best). Other values are hashed to a 32-byte key.

On Vercel, set `DATABASE_*` to the Supabase **session pooler** (port **5432**, user `postgres.<project-ref>`). The direct `db.<project-ref>.supabase.co` host is IPv6-only on many projects and Vercel cannot reach it. Run migrations from your laptop against the direct host; see [docs/migrations.md](docs/migrations.md).

The Mini App must be opened inside Telegram so `initData` is present.

## Admin activity sync

`POST /api/admin/activities/sync` lists one user’s Strava activities after a date (`GET /api/v3/athlete/activities?after=`), loads each activity’s details for `description`, and upserts rows whose **title or description** contains (case-insensitive) `kruzh`, `circles`, `evgeny istyukov`, or `serge akhlebinin`.

This is admin-only. Set at least one of:

- `ADMIN_SECRET` — send `X-Admin-Secret` or `Authorization: Bearer …`
- `ADMIN_TELEGRAM_USER_ID` — your Telegram id; the request must include valid Mini App `initData` for that account

```bash
curl -X POST https://<your-vercel-domain>/api/admin/activities/sync \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{"telegramUserId":"123456789","after":1704067200,"page":1}'
```

`after` is Unix seconds (Strava’s parameter) or an ISO date. If `hasMore` is true, call again with `page + 1`. Apply the `CreateActivities` migration first.

## Project layout

```
docs/migrations.md  How to create and apply TypeORM migrations
public/             Static assets (logo)
src/app/            Mini App routes and Route Handlers
src/app/api/        Server APIs (`/me`, `/athlete`, admin sync, Strava webhook and OAuth)
src/app/stats/      Athlete landing after Strava is linked
src/lib/db/         TypeORM data source, entities (`users`, `activities`), migrations
src/lib/strava/     Strava webhook, OAuth, and athlete helpers
src/lib/telegram/   Telegram initData verification
```
