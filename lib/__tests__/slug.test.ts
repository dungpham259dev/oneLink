import { describe, it, expect } from "vitest";
import { generateSlug, isValidCustomSlug } from "@/lib/slug";

describe("slug", () => {
  it("generates 6-char lowercase alnum slug", () => {
    const s = generateSlug();
    expect(s).toMatch(/^[a-z0-9]{6}$/);
  });
  it("validates custom slugs", () => {
    expect(isValidCustomSlug("my-app")).toBe(true);
    expect(isValidCustomSlug("ab")).toBe(false);
    expect(isValidCustomSlug("-bad")).toBe(false);
    expect(isValidCustomSlug("Bad Caps")).toBe(false);
  });
});
