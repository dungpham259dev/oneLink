import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { update: vi.fn() } } }));
vi.mock("@/lib/stripe", () => ({ stripe: {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
} }));

import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createCheckoutSession } from "@/app/app/billing/actions";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("createCheckoutSession", () => {
  beforeEach(() => vi.clearAllMocks());
  it("errors when unauthenticated", async () => {
    asMock(getCurrentUser).mockResolvedValue(null);
    expect(await createCheckoutSession()).toEqual({ error: "Unauthorized" });
  });
  it("creates a customer then a checkout url", async () => {
    asMock(getCurrentUser).mockResolvedValue({ id: "u1", email: "a@b.c", stripeCustomerId: null });
    asMock(stripe.customers.create).mockResolvedValue({ id: "cus_1" });
    asMock(db.user.update).mockResolvedValue({});
    asMock(stripe.checkout.sessions.create).mockResolvedValue({ url: "https://checkout" });
    expect(await createCheckoutSession()).toEqual({ url: "https://checkout" });
    expect(asMock(stripe.checkout.sessions.create).mock.calls[0][0].customer).toBe("cus_1");
  });
});
