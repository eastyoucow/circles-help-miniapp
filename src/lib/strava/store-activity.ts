import { upsertActivity } from "@/lib/db/activities";
import { User } from "@/lib/db/entities/user.entity";
import { activityMatchesInitiative } from "@/lib/strava/activity-match";
import type { StravaActivityDetails } from "@/lib/strava/client";

export async function storeActivityIfMatches(
  user: User,
  details: StravaActivityDetails,
): Promise<"inserted" | "updated" | "skipped"> {
  if (!activityMatchesInitiative(details.title, details.description)) {
    return "skipped";
  }

  return upsertActivity({
    userId: user.id,
    stravaActivityId: details.id,
    title: details.title,
    description: details.description,
    activityDate: details.activityDate,
    distance: details.distance,
    movingTime: details.movingTime,
    workoutType: details.workoutType,
  });
}
