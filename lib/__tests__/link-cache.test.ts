import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, unknown>();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); }),
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    del: vi.fn(async (k: string) => { store.delete(k); }),
  },
}));

import { putLinkCache, getLinkCache, deleteLinkCache, cacheKey } from "@/lib/link-cache";
import type { LinkConfig } from "@/lib/resolve";

const cfg: LinkConfig = { slug: "abc", iosUrl: "https://a", androidUrl: null, ipadUrl: null,
  huaweiUrl: null, windowsUrl: null, macUrl: null, fallbackUrl: null, parameterForwarding: false };

describe("link-cache", () => {
  beforeEach(() => store.clear());
  it("builds namespaced key", () => { expect(cacheKey("abc")).toBe("link:abc"); });
  it("round-trips a config", async () => {
    await putLinkCache(cfg);
    expect(await getLinkCache("abc")).toEqual(cfg);
  });
  it("returns null for missing slug", async () => {
    expect(await getLinkCache("nope")).toBeNull();
  });
  it("deletes a config", async () => {
    await putLinkCache(cfg); await deleteLinkCache("abc");
    expect(await getLinkCache("abc")).toBeNull();
  });
});
