import { getDataSource } from "@/lib/db/connection";
import { Activity } from "@/lib/db/entities/activity.entity";

export type ActivityFields = {
  userId: string;
  stravaActivityId: string;
  title: string;
  description: string;
  activityDate: Date;
  distance: number;
  movingTime: number;
  workoutType: number | null;
};

export async function upsertActivity(fields: ActivityFields): Promise<"inserted" | "updated"> {
  const repo = (await getDataSource()).getRepository(Activity);
  const existing = await repo.findOne({
    where: { stravaActivityId: fields.stravaActivityId },
  });

  if (existing) {
    existing.userId = fields.userId;
    existing.title = fields.title;
    existing.description = fields.description;
    existing.activityDate = fields.activityDate;
    existing.distance = fields.distance;
    existing.movingTime = fields.movingTime;
    existing.workoutType = fields.workoutType;
    await repo.save(existing);
    return "updated";
  }

  await repo.save(repo.create(fields));
  return "inserted";
}
