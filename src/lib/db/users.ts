import { getDataSource } from "@/lib/db/connection";
import { User } from "@/lib/db/entities/user.entity";

export async function findUserByTelegramId(
  telegramUserId: string,
): Promise<User | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).findOne({
    where: { telegramUserId },
  });
}

export async function findUserByStravaAthleteId(
  stravaAthleteId: string,
): Promise<User | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).findOne({
    where: { stravaAthleteId },
  });
}

export async function saveUser(user: User): Promise<User> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).save(user);
}

export async function listUsers(): Promise<User[]> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).find({
    order: { createdAt: "ASC" },
  });
}

export type UserActivityStats = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  activityCount: number;
};

export async function listUsersByActivityCount(): Promise<UserActivityStats[]> {
  const dataSource = await getDataSource();
  const rows = await dataSource
    .getRepository(User)
    .createQueryBuilder("user")
    .leftJoin("user.activities", "activity")
    .select("user.id", "id")
    .addSelect("user.firstName", "firstName")
    .addSelect("user.lastName", "lastName")
    .addSelect("user.profileImageUrl", "profileImageUrl")
    .addSelect("COUNT(activity.id)", "activityCount")
    .groupBy("user.id")
    .addGroupBy("user.firstName")
    .addGroupBy("user.lastName")
    .addGroupBy("user.profileImageUrl")
    .orderBy("COUNT(activity.id)", "DESC")
    .addOrderBy("user.firstName", "ASC")
    .getRawMany<Record<string, string | number | null>>();

  return rows.map((row) => ({
    id: String(rawValue(row, "id", "user_id") ?? ""),
    firstName: String(rawValue(row, "firstName", "user_firstName") ?? ""),
    lastName: String(rawValue(row, "lastName", "user_lastName") ?? ""),
    profileImageUrl: String(
      rawValue(row, "profileImageUrl", "user_profileImageUrl") ?? "",
    ),
    activityCount: Number(rawValue(row, "activityCount")) || 0,
  }));
}

function rawValue(
  row: Record<string, string | number | null>,
  ...keys: string[]
): string | number | null | undefined {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return row[keys[0]];
}
