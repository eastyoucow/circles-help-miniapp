import { timingSafeEqual } from "node:crypto";
import { User } from "@/lib/db/entities/user.entity";
import { getDataSource } from "@/lib/db/connection";

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

function isStravaAccessRevoked(event: StravaWebhookEvent): boolean {
  const authorized = event.updates?.authorized;
  return (
    event.object_type === "athlete" &&
    (authorized === "false" || authorized === false)
  );
}

export async function processStravaWebhookEvent(
  event: StravaWebhookEvent,
): Promise<void> {
  const dataSource = await getDataSource();
  const users = dataSource.getRepository(User);
  const athleteId = String(event.owner_id);
  const user = await users.findOne({
    where: { stravaAthleteId: athleteId },
  });

  if (!user) {
    return;
  }

  if (isStravaAccessRevoked(event)) {
    await users.remove(user);
    return;
  }

  if (event.object_type === "activity" && event.aspect_type === "create") {
    // Telegram notification will use user.telegramUserId once the bot is wired.
    console.info("strava activity created", {
      athleteId,
      activityId: event.object_id,
      telegramUserId: user.telegramUserId,
    });
  }
}
