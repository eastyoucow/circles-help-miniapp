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

export async function saveUser(user: User): Promise<User> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).save(user);
}
