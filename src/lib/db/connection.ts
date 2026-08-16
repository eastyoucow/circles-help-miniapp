import "reflect-metadata";
import { DataSource } from "typeorm";
import { getDataSourceOptions } from "./config";

const globalForDb = globalThis as typeof globalThis & {
  circlesHelpDataSource?: DataSource;
  circlesHelpDataSourcePromise?: Promise<DataSource>;
};

export async function getDataSource(): Promise<DataSource> {
  const existing = globalForDb.circlesHelpDataSource;
  if (existing?.isInitialized) {
    return existing;
  }

  if (!globalForDb.circlesHelpDataSourcePromise) {
    globalForDb.circlesHelpDataSourcePromise = (async () => {
      const dataSource = existing ?? new DataSource(getDataSourceOptions());
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      globalForDb.circlesHelpDataSource = dataSource;
      return dataSource;
    })().catch((error: unknown) => {
      globalForDb.circlesHelpDataSourcePromise = undefined;
      throw error;
    });
  }

  return globalForDb.circlesHelpDataSourcePromise;
}
