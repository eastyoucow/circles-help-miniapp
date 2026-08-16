import { timingSafeEqual } from "node:crypto";
import { deleteActivityByStravaId } from "@/lib/db/activities";
import { findUserByStravaAthleteId } from "@/lib/db/users";
import {
  getActivityById,
  withStravaUserToken,
} from "@/lib/strava/client";
import { storeActivityIfMatches } from "@/lib/strava/store-activity";

export type StravaWebhookEvent = {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
};

export function getStravaWebhookVerifyToken(): string {
  const token = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) {
    throw new Error("STRAVA_WEBHOOK_VERIFY_TOKEN is not set.");
  }
  return token;
}

export function isValidStravaVerifyToken(
  received: string | null,
  expected: string,
): boolean {
  if (!received) {
    return false;
  }

  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

export function parseStravaWebhookEvent(
  value: unknown,
): StravaWebhookEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const objectType = raw.object_type;
  const aspectType = raw.aspect_type;
  const objectId = asFiniteNumber(raw.object_id);
  const ownerId = asFiniteNumber(raw.owner_id);
  const subscriptionId = asFiniteNumber(raw.subscription_id);
  const eventTime = asFiniteNumber(raw.event_time);

  if (
    (objectType !== "activity" && objectType !== "athlete") ||
    (aspectType !== "create" &&
      aspectType !== "update" &&
      aspectType !== "delete") ||
    objectId === null ||
    ownerId === null ||
    subscriptionId === null ||
    eventTime === null
  ) {
    return null;
  }

  const updates =
    raw.updates && typeof raw.updates === "object"
      ? (raw.updates as Record<string, unknown>)
      : undefined;

  return {
    object_type: objectType,
    object_id: objectId,
    aspect_type: aspectType,
    owner_id: ownerId,
    subscription_id: subscriptionId,
    event_time: eventTime,
    updates,
  };
}

export async function processStravaWebhookEvent(
  event: StravaWebhookEvent,
): Promise<void> {
  if (event.object_type !== "activity") {
    return;
  }

  const stravaActivityId = String(event.object_id);

  if (event.aspect_type === "delete") {
    await deleteActivityByStravaId(stravaActivityId);
    return;
  }

  const user = await findUserByStravaAthleteId(String(event.owner_id));
  if (!user) {
    return;
  }

  const details = await withStravaUserToken(user, (token) =>
    getActivityById(token, stravaActivityId),
  );

  if (!details) {
    if (event.aspect_type === "create") {
      throw new Error(
        `Strava activity ${stravaActivityId} is not available yet.`,
      );
    }
    await deleteActivityByStravaId(stravaActivityId);
    return;
  }

  const result = await storeActivityIfMatches(user, details);
  if (result === "skipped" && event.aspect_type === "update") {
    await deleteActivityByStravaId(stravaActivityId);
  }
}
