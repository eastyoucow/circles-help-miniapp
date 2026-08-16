# Circles Help

Telegram bot + Mini App for the Circles Help channel. This repository is a Next.js App Router app, ready to deploy on Vercel.

The Mini App UI, Strava OAuth, Telegram/Strava webhooks, and server APIs will live in this same project. PostgreSQL stays on Supabase; the browser never talks to the database directly.

## Stack

- Next.js 16 (App Router) on Vercel
- TypeScript
- CSS Modules
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

## Project layout

```
public/           Static assets (logo)
src/app/          Mini App routes and Route Handlers
```
