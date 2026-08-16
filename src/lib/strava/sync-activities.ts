import { upsertActivity } from "@/lib/db/activities";
import { User } from "@/lib/db/entities/user.entity";
import { activityMatchesInitiative } from "@/lib/strava/activity-match";
import {
  getActivityById,
  listAthleteActivities,
  withStravaUserToken,
} from "@/lib/strava/client";

const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 50;

export type SyncActivitiesResult = {
  telegramUserId: string;
  after: number;
  page: number;
  perPage: number;
  scanned: number;
  matched: number;
  inserted: number;
  updated: number;
  skipped: number;
  hasMore: boolean;
};

export async function syncUserActivitiesAfter(options: {
  user: User;
  after: number;
  page: number;
  perPage: number;
}): Promise<SyncActivitiesResult> {
  const page = Math.max(1, options.page);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, options.perPage));

  const summaries = await withStravaUserToken(options.user, (token) =>
    listAthleteActivities(token, {
      after: options.after,
      page,
      perPage,
    }),
  );

  let matched = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const summary of summaries) {
    const details = await withStravaUserToken(options.user, (token) =>
      getActivityById(token, summary.id),
    );
    if (!details) {
      skipped += 1;
      continue;
    }

    if (!activityMatchesInitiative(details.title, details.description)) {
      skipped += 1;
      continue;
    }

    matched += 1;
    const result = await upsertActivity({
      userId: options.user.id,
      stravaActivityId: details.id,
      title: details.title,
      description: details.description,
      activityDate: details.activityDate,
      distance: details.distance,
      movingTime: details.movingTime,
      workoutType: details.workoutType,
    });
    if (result === "inserted") {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return {
    telegramUserId: options.user.telegramUserId,
    after: options.after,
    page,
    perPage,
    scanned: summaries.length,
    matched,
    inserted,
    updated,
    skipped,
    hasMore: summaries.length === perPage,
  };
}

export function clampActivityPageSize(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value)) {
    return DEFAULT_PER_PAGE;
  }
  return Math.min(MAX_PER_PAGE, Math.max(1, value));
}
