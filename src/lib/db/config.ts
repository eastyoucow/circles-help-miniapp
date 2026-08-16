import { existsSync } from "node:fs";
import { config } from "dotenv";
import type { DataSourceOptions } from "typeorm";
import { requiredEnv } from "../env";
import { User } from "./entities/user.entity";

if (existsSync(".env.local")) {
  config({ path: ".env.local", quiet: true });
} else if (existsSync(".env")) {
  config({ path: ".env", quiet: true });
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
    host: requiredEnv("DATABASE_HOST"),
    port: getDatabasePort(),
    database: requiredEnv("DATABASE_NAME"),
    username: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    ssl:
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
    entities: [User],
    migrations: ["src/lib/db/migrations/*.{ts,js}"],
    migrationsTableName: "typeorm_migrations",
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === "true",
  };
}
