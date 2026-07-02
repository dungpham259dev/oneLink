import { describe, it, expect } from "vitest";
import { parseUtm } from "@/lib/utm";

describe("parseUtm", () => {
  it("extracts utm params", () => {
    const r = parseUtm(new URLSearchParams("utm_source=fb&utm_medium=cpc&utm_campaign=launch"));
    expect(r).toEqual({ utmSource: "fb", utmMedium: "cpc", utmCampaign: "launch" });
  });
  it("returns nulls when absent", () => {
    expect(parseUtm(new URLSearchParams(""))).toEqual({ utmSource: null, utmMedium: null, utmCampaign: null });
  });
});
