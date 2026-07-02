import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics-queue", () => ({ drainEvents: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  link: { findMany: vi.fn() }, analyticsEvent: { createMany: vi.fn() } } }));

import { drainEvents } from "@/lib/analytics-queue";
import { db } from "@/lib/db";
import { flushAnalytics } from "@/lib/flush";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("flushAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps slug to link id and inserts", async () => {
    asMock(drainEvents).mockResolvedValue([
      { linkId: "abc", deviceType: "IOS", os: "iOS", country: "US", referrer: null,
        utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
        timestamp: "2026-07-02T00:00:00.000Z" },
    ]);
    asMock(db.link.findMany).mockResolvedValue([{ id: "link1", slug: "abc" }]);
    asMock(db.analyticsEvent.createMany).mockResolvedValue({ count: 1 });
    const r = await flushAnalytics(100);
    expect(r.inserted).toBe(1);
    expect(asMock(db.analyticsEvent.createMany).mock.calls[0][0].data[0].linkId).toBe("link1");
  });
  it("drops events for missing slugs", async () => {
    asMock(drainEvents).mockResolvedValue([
      { linkId: "gone", deviceType: "IOS", os: "iOS", country: null, referrer: null,
        utmSource: null, utmMedium: null, utmCampaign: null, redirectedTo: "MATCHED",
        timestamp: "2026-07-02T00:00:00.000Z" },
    ]);
    asMock(db.link.findMany).mockResolvedValue([]);
    const r = await flushAnalytics(100);
    expect(r.inserted).toBe(0);
  });
  it("returns zero when queue empty", async () => {
    asMock(drainEvents).mockResolvedValue([]);
    expect((await flushAnalytics(100)).inserted).toBe(0);
  });
});
