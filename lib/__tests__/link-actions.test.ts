import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { link: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(),
  update: vi.fn(), delete: vi.fn() } } }));
vi.mock("@/lib/link-cache", () => ({ putLinkCache: vi.fn(), deleteLinkCache: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createLink } from "@/app/app/links/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("createLink", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    const r = await createLink({ parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Unauthorized" });
  });
  it("blocks 4th link on free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(3);
    const r = await createLink({ parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Link limit reached for your plan" });
  });
  it("rejects custom slug on free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(0);
    const r = await createLink({ customSlug: "my-app", parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Custom slugs require Pro" });
  });
  it("creates link with random slug and caches it", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.count).mockResolvedValue(0);
    asMock(db.link.findFirst).mockResolvedValue(null);
    asMock(db.link.create).mockImplementation(async ({ data }: { data: { slug: string } }) =>
      ({ id: "l1", parameterForwarding: false, ...data }));
    const r = await createLink({ iosUrl: "https://apps.apple.com/x", parameterForwarding: false });
    expect(r.ok).toBe(true);
  });
});
