import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";

describe("getCurrentUser", () => {
  beforeEach(() => vi.clearAllMocks());
  it("returns null when no session", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await getCurrentUser()).toBeNull();
  });
  it("returns user when session exists", async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: "u1" } });
    (db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", plan: "FREE" });
    expect((await getCurrentUser())?.id).toBe("u1");
  });
});
