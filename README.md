# Circles Help

Telegram bot + Mini App for the Circles Help channel. This repository is a Next.js App Router app, ready to deploy on Vercel.

The Mini App UI, Strava OAuth, Telegram/Strava webhooks, and server APIs will live in this same project. PostgreSQL stays on Supabase; the browser never talks to the database directly.

## Stack

- Next.js 16 (App Router) on Vercel
- TypeScript
- Tailwind CSS
- PostgreSQL on Supabase (not wired up yet)

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

## Deploy on Vercel

Vercel detects Next.js automatically. No `vercel.json` or custom server is required.

1. Import this GitHub repository at [vercel.com/new](https://vercel.com/new).
2. Keep the defaults: Framework **Next.js**, build `next build`, output left empty.
3. Add environment variables from `.env.example` when they exist.
4. Deploy.

Hobby is enough for OAuth callbacks and webhooks. Do not use long polling or long-running workers on Vercel.

## Project layout

```
src/app/          Mini App routes and Route Handlers
```
