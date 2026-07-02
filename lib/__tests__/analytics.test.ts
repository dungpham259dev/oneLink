import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: {
  analyticsEvent: { count: vi.fn(), groupBy: vi.fn() } } }));

import { db } from "@/lib/db";
import { getLinkStats } from "@/lib/analytics";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("getLinkStats", () => {
  beforeEach(() => vi.clearAllMocks());
  it("aggregates counts by dimension", async () => {
    asMock(db.analyticsEvent.count).mockResolvedValue(5);
    asMock(db.analyticsEvent.groupBy).mockImplementation(async ({ by }: { by: string[] }) => {
      if (by[0] === "deviceType") return [{ deviceType: "IOS", _count: { _all: 3 } }, { deviceType: "ANDROID", _count: { _all: 2 } }];
      if (by[0] === "country") return [{ country: "US", _count: { _all: 5 } }];
      if (by[0] === "referrer") return [{ referrer: null, _count: { _all: 5 } }];
      return [{ redirectedTo: "MATCHED", _count: { _all: 5 } }];
    });
    const r = await getLinkStats("l1", new Date("2026-06-01"), new Date("2026-07-01"));
    expect(r.total).toBe(5);
    expect(r.byDevice.IOS).toBe(3);
    expect(r.byCountry.US).toBe(5);
  });
});
