import type { DeviceType, RedirectTarget } from "@prisma/client";
import { redis } from "@/lib/redis";

export const ANALYTICS_QUEUE_KEY = "analytics:queue";

export type AnalyticsPayload = {
  linkId: string; deviceType: DeviceType; os: string; country: string | null;
  referrer: string | null; utmSource: string | null; utmMedium: string | null;
  utmCampaign: string | null; redirectedTo: RedirectTarget; timestamp: string;
};

export async function enqueueEvent(payload: AnalyticsPayload): Promise<void> {
  await redis.rpush(ANALYTICS_QUEUE_KEY, JSON.stringify(payload));
}

export async function drainEvents(max: number): Promise<AnalyticsPayload[]> {
  const raw = (await redis.lpop(ANALYTICS_QUEUE_KEY, max)) as string[] | null;
  if (!raw || raw.length === 0) return [];
  return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AnalyticsPayload);
}
