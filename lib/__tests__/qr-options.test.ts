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
  it("applies gradient to dots when gradient config provided", () => {
    const o = buildQrOptions("https://x", { fgColor: "#000000", bgColor: "#ffffff",
      dotStyle: "rounded", cornerStyle: "square", margin: 8, size: 256,
      gradient: { type: "linear", from: "#ff0000", to: "#0000ff" }, logoUrl: null });
    expect(o.dotsOptions?.color).toBeUndefined();
    expect(o.dotsOptions?.gradient?.type).toBe("linear");
    expect(o.dotsOptions?.gradient?.colorStops).toEqual([
      { offset: 0, color: "#ff0000" },
      { offset: 1, color: "#0000ff" }
    ]);
  });
  it("applies extra-rounded corner style when cornerStyle is rounded", () => {
    const o = buildQrOptions("https://x", { fgColor: "#111111", bgColor: "#eeeeee",
      dotStyle: "rounded", cornerStyle: "rounded", margin: 8, size: 320, gradient: null, logoUrl: null });
    expect(o.cornersSquareOptions?.type).toBe("extra-rounded");
  });
});
