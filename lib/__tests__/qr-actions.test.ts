import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { link: { findFirst: vi.fn() }, qrConfig: { upsert: vi.fn() } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { saveQrConfig } from "@/app/app/links/[id]/qr/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;
const baseInput = { fgColor: "#000000", bgColor: "#ffffff", dotStyle: "square" as const,
  cornerStyle: "square" as const, margin: 10, size: 300, gradient: null, logoUrl: "https://blob/logo.png" };

describe("saveQrConfig", () => {
  beforeEach(() => vi.clearAllMocks());
  it("strips logo for free plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "FREE" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1" });
    asMock(db.qrConfig.upsert).mockResolvedValue({});
    const r = await saveQrConfig("l1", baseInput);
    expect(r.ok).toBe(true);
    const arg = asMock(db.qrConfig.upsert).mock.calls[0][0];
    expect(arg.create.logoUrl).toBeNull();
  });
  it("keeps logo for pro plan", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", plan: "PRO" });
    asMock(db.link.findFirst).mockResolvedValue({ id: "l1" });
    asMock(db.qrConfig.upsert).mockResolvedValue({});
    await saveQrConfig("l1", baseInput);
    const arg = asMock(db.qrConfig.upsert).mock.calls[0][0];
    expect(arg.create.logoUrl).toBe("https://blob/logo.png");
  });
});
