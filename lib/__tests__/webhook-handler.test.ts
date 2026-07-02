import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ db: {
  user: { findFirst: vi.fn(), update: vi.fn() },
  subscription: { upsert: vi.fn() },
} }));

import { db } from "@/lib/db";
import { handleStripeEvent } from "@/lib/webhook-handler";

const asMock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("handleStripeEvent", () => {
  beforeEach(() => vi.clearAllMocks());
  it("upgrades user to PRO on subscription updated", async () => {
    asMock(db.user.findFirst).mockResolvedValue({ id: "u1" });
    asMock(db.user.update).mockResolvedValue({});
    asMock(db.subscription.upsert).mockResolvedValue({});
    await handleStripeEvent({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_1", status: "active",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update).mock.calls[0][0].data.plan).toBe("PRO");
  });
  it("downgrades to FREE on subscription deleted", async () => {
    asMock(db.user.findFirst).mockResolvedValue({ id: "u1" });
    asMock(db.user.update).mockResolvedValue({});
    await handleStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_1", status: "canceled",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update).mock.calls[0][0].data.plan).toBe("FREE");
  });
  it("no-ops on subscription updated when user is not found", async () => {
    asMock(db.user.findFirst).mockResolvedValue(null);
    await handleStripeEvent({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", customer: "cus_missing", status: "active",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update)).not.toHaveBeenCalled();
    expect(asMock(db.subscription.upsert)).not.toHaveBeenCalled();
  });
  it("no-ops on subscription deleted when user is not found", async () => {
    asMock(db.user.findFirst).mockResolvedValue(null);
    await handleStripeEvent({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", customer: "cus_missing", status: "canceled",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update)).not.toHaveBeenCalled();
  });
  it("skips subscription upsert when event object id is not a sub_ id", async () => {
    asMock(db.user.findFirst).mockResolvedValue({ id: "u1" });
    asMock(db.user.update).mockResolvedValue({});
    await handleStripeEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", customer: "cus_1", status: "complete",
        current_period_end: 1893456000 } },
    } as never);
    expect(asMock(db.user.update).mock.calls[0][0].data.plan).toBe("PRO");
    expect(asMock(db.subscription.upsert)).not.toHaveBeenCalled();
  });
  it("ignores unhandled event types", async () => {
    await handleStripeEvent({ type: "invoice.paid", data: { object: {} } } as never);
    expect(asMock(db.user.findFirst)).not.toHaveBeenCalled();
  });
});
