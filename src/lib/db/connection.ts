import { DataSource } from "typeorm";
import { getDataSourceOptions } from "./config";

const globalForDb = globalThis as typeof globalThis & {
  circlesHelpDataSource?: DataSource;
};

export async function getDataSource(): Promise<DataSource> {
  const existing = globalForDb.circlesHelpDataSource;
  if (existing?.isInitialized) {
    return existing;
  }

  const dataSource = existing ?? new DataSource(getDataSourceOptions());
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  globalForDb.circlesHelpDataSource = dataSource;
  return dataSource;
}
