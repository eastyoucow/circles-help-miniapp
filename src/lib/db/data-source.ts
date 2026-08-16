import { DataSource } from "typeorm";
import { getDataSourceOptions } from "./config";

export const AppDataSource = new DataSource(getDataSourceOptions());
