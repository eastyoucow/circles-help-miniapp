import { existsSync } from "node:fs";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";

if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add the Supabase Postgres URI. See docs/migrations.md.",
    );
  }
  return url;
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: getDatabaseUrl(),
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  entities: [User],
  migrations: ["src/lib/db/migrations/*.{ts,js}"],
  migrationsTableName: "typeorm_migrations",
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === "true",
});
