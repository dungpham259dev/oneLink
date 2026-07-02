import type Stripe from "stripe";
import { db } from "@/lib/db";

async function userByCustomer(customerId: string) {
  return db.user.findFirst({ where: { stripeCustomerId: customerId } });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated": {
      const obj = event.data.object as unknown as {
        id: string;
        customer: string;
        status: string;
        current_period_end?: number;
        items?: { data?: Array<{ current_period_end?: number }> };
      };
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const user = await userByCustomer(customerId);
      if (!user) return;
      const periodEndTimestamp = obj.items?.data?.[0]?.current_period_end ?? obj.current_period_end ?? 0;
      const periodEnd = new Date(periodEndTimestamp * 1000);
      await db.user.update({ where: { id: user.id }, data: { plan: "PRO", planExpiresAt: periodEnd } });
      if (obj.id?.startsWith("sub_")) {
        await db.subscription.upsert({
          where: { userId: user.id },
          create: { userId: user.id, stripeSubscriptionId: obj.id, status: obj.status, currentPeriodEnd: periodEnd },
          update: { stripeSubscriptionId: obj.id, status: obj.status, currentPeriodEnd: periodEnd },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const obj = event.data.object as { customer: string };
      const customerId = typeof obj.customer === "string" ? obj.customer : "";
      const user = await userByCustomer(customerId);
      if (!user) return;
      await db.user.update({ where: { id: user.id }, data: { plan: "FREE", planExpiresAt: null } });
      break;
    }
    default: break;
  }
}
