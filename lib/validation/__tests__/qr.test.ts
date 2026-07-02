import { describe, it, expect } from "vitest";
import { qrConfigSchema } from "@/lib/validation/qr";

describe("qrConfigSchema", () => {
  it("applies defaults when given an empty object", () => {
    const result = qrConfigSchema.parse({});
    expect(result.fgColor).toBe("#000000");
    expect(result.bgColor).toBe("#ffffff");
    expect(result.dotStyle).toBe("square");
    expect(result.cornerStyle).toBe("square");
    expect(result.margin).toBe(10);
    expect(result.size).toBe(300);
    expect(result.gradient).toBeNull();
    expect(result.logoUrl).toBeNull();
  });

  it("accepts valid custom values including a gradient", () => {
    const result = qrConfigSchema.parse({
      fgColor: "#ff0000",
      bgColor: "#00ff00",
      dotStyle: "rounded",
      cornerStyle: "rounded",
      margin: 20,
      size: 500,
      gradient: { from: "#111111", to: "#222222", type: "radial" },
      logoUrl: "https://example.com/logo.png",
    });
    expect(result.gradient).toEqual({ from: "#111111", to: "#222222", type: "radial" });
    expect(result.logoUrl).toBe("https://example.com/logo.png");
  });

  it("rejects an invalid hex color", () => {
    expect(() => qrConfigSchema.parse({ fgColor: "red" })).toThrow();
  });

  it("rejects a margin outside the allowed range", () => {
    expect(() => qrConfigSchema.parse({ margin: 999 })).toThrow();
  });

  it("rejects an invalid dotStyle enum value", () => {
    expect(() => qrConfigSchema.parse({ dotStyle: "hexagon" })).toThrow();
  });
});
