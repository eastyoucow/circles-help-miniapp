import { listUsers } from "@/lib/db/users";
import { User } from "@/lib/db/entities/user.entity";
import {
  StravaApiError,
  getActivityById,
  listAthleteActivities,
  withStravaUserToken,
} from "@/lib/strava/client";
import { storeActivityIfMatches } from "@/lib/strava/store-activity";

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

    const result = await storeActivityIfMatches(options.user, details);
    if (result === "skipped") {
      skipped += 1;
      continue;
    }

    matched += 1;
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

const MAX_PAGES_PER_USER = 20;

export type SyncAllUsersResult = {
  after: number;
  users: number;
  failed: number;
  scanned: number;
  matched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { telegramUserId: string; error: string }[];
};

export async function syncAllUsersActivitiesAfter(
  after: number,
): Promise<SyncAllUsersResult> {
  const users = await listUsers();
  const totals: SyncAllUsersResult = {
    after,
    users: users.length,
    failed: 0,
    scanned: 0,
    matched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const user of users) {
    try {
      const result = await syncUserAllPages(user, after);
      totals.scanned += result.scanned;
      totals.matched += result.matched;
      totals.inserted += result.inserted;
      totals.updated += result.updated;
      totals.skipped += result.skipped;
    } catch (error) {
      totals.failed += 1;
      totals.errors.push({
        telegramUserId: user.telegramUserId,
        error:
          error instanceof StravaApiError
            ? error.message
            : "Could not sync Strava activities.",
      });
      console.error(
        "activity sync failed for user",
        user.telegramUserId,
        error,
      );
    }
  }

  return totals;
}

async function syncUserAllPages(
  user: User,
  after: number,
): Promise<
  Pick<
    SyncActivitiesResult,
    "scanned" | "matched" | "inserted" | "updated" | "skipped"
  >
> {
  const totals = {
    scanned: 0,
    matched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  for (let page = 1; page <= MAX_PAGES_PER_USER; page += 1) {
    const result = await syncUserActivitiesAfter({
      user,
      after,
      page,
      perPage: MAX_PER_PAGE,
    });
    totals.scanned += result.scanned;
    totals.matched += result.matched;
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
    if (!result.hasMore) {
      break;
    }
  }

  return totals;
}
