import { describe, it, expect, vi, beforeEach } from "vitest";

const list: string[] = [];
vi.mock("@/lib/redis", () => ({
  redis: {
    rpush: vi.fn(async (_k: string, v: string) => { list.push(v); }),
    lpop: vi.fn(async (_k: string, n: number) => list.splice(0, n)),
  },
}));

import { enqueueEvent, drainEvents, type AnalyticsPayload } from "@/lib/analytics-queue";

const evt: AnalyticsPayload = { linkId: "l1", deviceType: "IOS", os: "iOS", country: "US",
  referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
  timestamp: "2026-07-02T00:00:00.000Z" };

describe("analytics-queue", () => {
  beforeEach(() => { list.length = 0; });
  it("enqueues and drains events", async () => {
    await enqueueEvent(evt);
    const drained = await drainEvents(10);
    expect(drained).toHaveLength(1);
    expect(drained[0].linkId).toBe("l1");
  });
  it("drains nothing when empty", async () => {
    expect(await drainEvents(10)).toEqual([]);
  });
});
