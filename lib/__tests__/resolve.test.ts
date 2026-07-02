import { describe, it, expect } from "vitest";
import { resolveDestination, type LinkConfig } from "@/lib/resolve";

const base: LinkConfig = {
  slug: "abc", iosUrl: "https://apps.apple.com/x", androidUrl: "https://play.google.com/y",
  ipadUrl: null, huaweiUrl: null, windowsUrl: null, macUrl: null,
  fallbackUrl: "https://example.com", parameterForwarding: false,
};

describe("resolveDestination", () => {
  it("returns iOS url for IOS device as MATCHED", () => {
    const r = resolveDestination(base, "IOS", "");
    expect(r.url).toBe("https://apps.apple.com/x");
    expect(r.target).toBe("MATCHED");
  });
  it("falls back when no device url", () => {
    const r = resolveDestination(base, "WINDOWS", "");
    expect(r.url).toBe("https://example.com");
    expect(r.target).toBe("FALLBACK");
  });
  it("ipad falls back to ios url when ipadUrl empty", () => {
    const r = resolveDestination(base, "IPADOS", "");
    expect(r.url).toBe("https://apps.apple.com/x");
    expect(r.target).toBe("MATCHED");
  });
  it("returns landing when no url at all", () => {
    const r = resolveDestination({ ...base, iosUrl: null, androidUrl: null, fallbackUrl: null }, "IOS", "");
    expect(r.url).toBeNull();
    expect(r.target).toBe("LANDING");
  });
  it("forwards query params when enabled", () => {
    const r = resolveDestination({ ...base, parameterForwarding: true }, "IOS", "utm_source=fb");
    expect(r.url).toBe("https://apps.apple.com/x?utm_source=fb");
  });
  it("huawei falls back to androidUrl when huaweiUrl empty", () => {
    const r = resolveDestination(base, "HUAWEI", "");
    expect(r.url).toBe("https://play.google.com/y");
    expect(r.target).toBe("MATCHED");
  });
  it("returns androidUrl for ANDROID device", () => {
    const r = resolveDestination(base, "ANDROID", "");
    expect(r.url).toBe("https://play.google.com/y");
    expect(r.target).toBe("MATCHED");
  });
  it("returns null for MACOS device when macUrl unset", () => {
    const r = resolveDestination(base, "MACOS", "");
    expect(r.url).toBe("https://example.com");
    expect(r.target).toBe("FALLBACK");
  });
  it("appends query with & when fallback url already has a query string", () => {
    const r = resolveDestination(
      { ...base, iosUrl: null, androidUrl: null, fallbackUrl: "https://example.com?x=1", parameterForwarding: true },
      "IOS",
      "utm_source=fb"
    );
    expect(r.url).toBe("https://example.com?x=1&utm_source=fb");
  });
  it("does not append empty query string", () => {
    const r = resolveDestination({ ...base, parameterForwarding: true }, "IOS", "");
    expect(r.url).toBe("https://apps.apple.com/x");
  });
});
