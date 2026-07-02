import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, canCreateLink } from "@/lib/plans";

describe("plan limits", () => {
  it("free allows 3 links max", () => {
    expect(PLAN_LIMITS.FREE.maxLinks).toBe(3);
    expect(canCreateLink("FREE", 2)).toBe(true);
    expect(canCreateLink("FREE", 3)).toBe(false);
  });
  it("pro is unlimited", () => {
    expect(PLAN_LIMITS.PRO.maxLinks).toBeNull();
    expect(canCreateLink("PRO", 9999)).toBe(true);
  });
  it("pro unlocks qr logo and custom slug", () => {
    expect(PLAN_LIMITS.PRO.qrLogo).toBe(true);
    expect(PLAN_LIMITS.FREE.qrLogo).toBe(false);
    expect(PLAN_LIMITS.PRO.customSlug).toBe(true);
  });
});
