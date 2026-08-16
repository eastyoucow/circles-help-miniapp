import { existsSync } from "node:fs";
import { config } from "dotenv";
import * as pg from "pg";
import type { DataSourceOptions } from "typeorm";
import { requiredEnv } from "../env";
import { Activity } from "./entities/activity.entity";
import { User } from "./entities/user.entity";
import { CreateActivities1786908000000 } from "./migrations/1786908000000-CreateActivities";
import { CreateUsers1786882695159 } from "./migrations/1786882695159-CreateUsers";

if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
}

function getPostgresDriver(): typeof pg {
  const mod = pg as unknown as {
    Pool?: unknown;
    default?: { Pool?: unknown };
  };
  if (typeof mod.Pool === "function") {
    return pg;
  }
  if (mod.default && typeof mod.default.Pool === "function") {
    return mod.default as typeof pg;
  }
  throw new Error(
    'Postgres package has not been found installed. Please run "npm install pg".',
  );
}

function getDatabasePort(): number {
  const raw = requiredEnv("DATABASE_PORT");
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`DATABASE_PORT must be a positive integer, received "${raw}".`);
  }
  return port;
}

export function getDataSourceOptions(): DataSourceOptions {
  return {
    type: "postgres",
    driver: getPostgresDriver(),
    nativeDriver: false,
    host: requiredEnv("DATABASE_HOST"),
    port: getDatabasePort(),
    database: requiredEnv("DATABASE_NAME"),
    username: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    ssl:
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
    uuidExtension: "pgcrypto",
    installExtensions: false,
    connectTimeoutMS: 10_000,
    extra: {
      connectionTimeoutMillis: 10_000,
      max: 4,
    },
    entities: [User, Activity],
    migrations: [CreateUsers1786882695159, CreateActivities1786908000000],
    migrationsTableName: "typeorm_migrations",
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === "true",
  };
}
