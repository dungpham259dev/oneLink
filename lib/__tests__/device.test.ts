import { describe, it, expect } from "vitest";
import { detectDevice } from "@/lib/device";

describe("detectDevice", () => {
  it("detects iPhone", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)").device).toBe("IOS");
  });
  it("detects iPad", () => {
    expect(detectDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)").device).toBe("IPADOS");
  });
  it("detects Huawei device", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 10; HUAWEI P40 Build/HUAWEIANA)").device).toBe("HUAWEI");
  });
  it("detects generic Android", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7)").device).toBe("ANDROID");
  });
  it("detects Windows", () => {
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)").device).toBe("WINDOWS");
  });
  it("detects macOS", () => {
    expect(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)").device).toBe("MACOS");
  });
  it("falls back to OTHER", () => {
    expect(detectDevice("curl/8.0").device).toBe("OTHER");
  });
});
