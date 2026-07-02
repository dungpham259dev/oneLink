import { describe, it, expect } from "vitest";
import { linkInputSchema } from "@/lib/validation/link";

describe("linkInputSchema", () => {
  it("parses a minimal valid input with defaults", () => {
    const result = linkInputSchema.parse({});
    expect(result.parameterForwarding).toBe(false);
    expect(result.iosUrl).toBeUndefined();
  });

  it("accepts valid urls for all platform fields", () => {
    const result = linkInputSchema.parse({
      name: "My App",
      customSlug: "my-app",
      iosUrl: "https://apps.apple.com/x",
      ipadUrl: "https://apps.apple.com/x",
      androidUrl: "https://play.google.com/y",
      huaweiUrl: "https://appgallery.huawei.com/z",
      windowsUrl: "https://microsoft.com/store/w",
      macUrl: "https://apps.apple.com/mac",
      fallbackUrl: "https://example.com",
      parameterForwarding: true,
    });
    expect(result.iosUrl).toBe("https://apps.apple.com/x");
    expect(result.parameterForwarding).toBe(true);
  });

  it("treats empty string urls as undefined", () => {
    const result = linkInputSchema.parse({ iosUrl: "" });
    expect(result.iosUrl).toBeUndefined();
  });

  it("rejects an invalid url", () => {
    expect(() => linkInputSchema.parse({ iosUrl: "not-a-url" })).toThrow();
  });

  it("rejects a name longer than 100 characters", () => {
    expect(() => linkInputSchema.parse({ name: "a".repeat(101) })).toThrow();
  });
});
