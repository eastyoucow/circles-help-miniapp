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
- `POST` receives activity/athlete events and acknowledges them. Event processing (notifications, revoke/`isDeleted`) is not implemented yet.

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

The callback exchanges the code, encrypts tokens, and inserts or updates the `users` row keyed by Telegram user id.

In the [Strava API settings](https://www.strava.com/settings/api), set **Authorization Callback Domain** to the Vercel host only (`your-app.vercel.app`, no `https://` and no path). Set `STRAVA_OAUTH_REDIRECT_URI` to the full callback URL above. `TOKEN_ENCRYPTION_KEY` must be 32 bytes (64-char hex or base64).

The Mini App must be opened inside Telegram so `initData` is present.

## Project layout

```
docs/migrations.md  How to create and apply TypeORM migrations
public/             Static assets (logo)
src/app/            Mini App routes and Route Handlers
src/app/api/        Server APIs (Strava webhook and OAuth)
src/lib/db/         TypeORM data source, entities, migrations
src/lib/strava/     Strava webhook and OAuth helpers
src/lib/telegram/   Telegram initData verification
```
