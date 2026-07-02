import { describe, it, expect } from "vitest";
import { buildQrOptions } from "@/lib/qr-options";

describe("buildQrOptions", () => {
  it("maps colors and dot style", () => {
    const o = buildQrOptions("https://x", { fgColor: "#111111", bgColor: "#eeeeee",
      dotStyle: "rounded", cornerStyle: "square", margin: 8, size: 320, gradient: null, logoUrl: null });
    expect(o.data).toBe("https://x");
    expect(o.width).toBe(320);
    expect(o.dotsOptions?.color).toBe("#111111");
    expect(o.dotsOptions?.type).toBe("rounded");
    expect(o.backgroundOptions?.color).toBe("#eeeeee");
  });
  it("includes image when logoUrl present", () => {
    const o = buildQrOptions("https://x", { fgColor: "#000000", bgColor: "#ffffff",
      dotStyle: "square", cornerStyle: "square", margin: 10, size: 300, gradient: null, logoUrl: "https://blob/l.png" });
    expect(o.image).toBe("https://blob/l.png");
  });
});
