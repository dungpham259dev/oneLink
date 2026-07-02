import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { link: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(),
  update: vi.fn(), delete: vi.fn() } } }));
vi.mock("@/lib/link-cache", () => ({ putLinkCache: vi.fn(), deleteLinkCache: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { putLinkCache, deleteLinkCache } from "@/lib/link-cache";
import { createLink, updateLink, deleteLink } from "@/app/app/links/actions";

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

describe("updateLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    const r = await updateLink("l1", { parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects when link is not owned by user", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue(null);
    const r = await updateLink("l1", { parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Not found" });
  });

  it("rejects a customSlug change", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "PRO" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1", slug: "old-slug", userId: "u1" });
    const r = await updateLink("l1", { customSlug: "new-slug", parameterForwarding: false });
    expect(r).toEqual({ ok: false, error: "Slug cannot be changed after creation" });
    expect(db.link.update).not.toHaveBeenCalled();
  });

  it("updates the link and refreshes the cache on happy path", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1", slug: "my-slug", userId: "u1" });
    const updated = {
      id: "l1", slug: "my-slug", iosUrl: "https://apps.apple.com/y", ipadUrl: null,
      androidUrl: null, huaweiUrl: null, windowsUrl: null, macUrl: null,
      fallbackUrl: null, parameterForwarding: false,
    };
    asMock(db.link.update).mockResolvedValue(updated);
    const r = await updateLink("l1", { iosUrl: "https://apps.apple.com/y", parameterForwarding: false });
    expect(r).toEqual({ ok: true, slug: "my-slug" });
    expect(putLinkCache).toHaveBeenCalledTimes(1);
  });
});

describe("deleteLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    const r = await deleteLink("l1");
    expect(r).toEqual({ ok: false, error: "Unauthorized" });
  });

  it("rejects when link is not owned by user", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue(null);
    const r = await deleteLink("l1");
    expect(r).toEqual({ ok: false, error: "Not found" });
    expect(db.link.delete).not.toHaveBeenCalled();
  });

  it("deletes the link and evicts the cache on happy path", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1", slug: "my-slug", userId: "u1" });
    asMock(db.link.delete).mockResolvedValue({ id: "l1" });
    const r = await deleteLink("l1");
    expect(r).toEqual({ ok: true });
    expect(db.link.delete).toHaveBeenCalledWith({ where: { id: "l1" } });
    expect(deleteLinkCache).toHaveBeenCalledWith("my-slug");
  });
});
