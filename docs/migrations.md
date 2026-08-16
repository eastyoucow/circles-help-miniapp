# TypeORM migrations (Supabase Postgres)

This app uses [TypeORM](https://typeorm.io) against the Supabase Postgres database. Schema changes go through migrations. Do not turn on `synchronize`.

The Mini App never talks to the database. Only server-side Next.js code and these CLI commands do.

## 1. Get a connection string

In the [Supabase dashboard](https://supabase.com/dashboard):

1. Open the project.
2. Go to **Project Settings → Database**.
3. Copy the **URI** for the **direct connection** (host `db.<project-ref>.supabase.co`, **port 5432**).

Use that URI for migrations. The transaction pooler (port **6543**) is for short queries and can fail TypeORM migrations (advisory locks).

Example:

```bash
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
```

If the password has special characters, URL-encode them (`@` → `%40`, `#` → `%23`).

## 2. Set environment variables

```bash
cp .env.example .env.local
```

Set:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres URI above |
| `DATABASE_SSL` | Leave unset (SSL on). Set `false` only for a local Postgres without SSL |
| `TYPEORM_LOGGING` | Set `true` to log SQL |

`.env.local` is gitignored. The CLI loads `.env.local`, then `.env`.

## 3. Apply pending migrations

From the repo root:

```bash
npm install
npm run migration:run
```

This creates `typeorm_migrations` (TypeORM’s bookkeeping table) and applies anything not yet recorded, including `CreateUsers`.

Check status:

```bash
npm run migration:show
```

`[X]` = applied, `[ ]` = pending.

## 4. Create a new migration

### Empty file (SQL you write yourself)

```bash
npm run migration:create -- src/lib/db/migrations/AddSomething
```

TypeORM writes `src/lib/db/migrations/<timestamp>-AddSomething.ts`. Fill in `up` and `down`.

### From entity changes (diff against the live database)

1. Edit entities under `src/lib/db/entities/`.
2. Register new entity classes in `src/lib/db/data-source.ts` (`entities: [...]`).
3. Generate:

```bash
npm run migration:generate -- src/lib/db/migrations/AddSomething
```

This needs a working `DATABASE_URL` and compares entities to the current schema. Review the generated SQL before applying.

## 5. Run and revert

```bash
npm run migration:run
npm run migration:revert
```

`revert` undoes **only the last** applied migration (`down`). Re-run `migration:run` to apply it again.

## 6. Conventions

- Keep `synchronize: false` in `src/lib/db/data-source.ts`.
- Put entities in `src/lib/db/entities/`.
- Put migrations in `src/lib/db/migrations/`.
- Use snake_case column names in Postgres (`telegram_user_id`) and camelCase on the entity (`telegramUserId`).
- Store Telegram and Strava ids as `bigint` in SQL and `string` in TypeScript.
- Never put secrets in a migration file.

## Troubleshooting

**`DATABASE_URL is not set`**  
Create `.env.local` and add the URI. Run commands from the repo root.

**`no pg_hba.conf entry` / SSL error**  
Keep `?sslmode=require` on the URI. Do not set `DATABASE_SSL=false` against Supabase.

**Migration hangs or `must be owner of table`**  
Use the direct connection (port 5432), not the transaction pooler (6543). Use the `postgres` role (or another role that owns the tables).

**IPv6 timeout on some networks**  
In Supabase, use the **session pooler** on port **5432** (not 6543) if the direct host is unreachable. Still avoid 6543 for migrations.

**Generate produced an empty or huge diff**  
Confirm you applied existing migrations first (`npm run migration:show`). Confirm new entities are listed in `data-source.ts`.
