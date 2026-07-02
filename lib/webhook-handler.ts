import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

async function userByCustomer(customerId: string) {
  if (!customerId) return null;
  return db.user.findFirst({ where: { stripeCustomerId: customerId } });
}

/**
 * In the Basil+ API (2025 onward) `current_period_end` lives on the
 * subscription item, not the subscription root. Fall back to the root and
 * finally to `null` so we never write a bogus 1970 date.
 */
function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
  const itemEnd = sub.items?.data?.[0]?.current_period_end;
  const rootEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const ts = itemEnd ?? rootEnd;
  return typeof ts === "number" && ts > 0 ? new Date(ts * 1000) : null;
}

async function resolveUser(customerId: string, sub: Stripe.Subscription) {
  const byCustomer = await userByCustomer(customerId);
  if (byCustomer) return byCustomer;

  // Fallback: the customer id may not be mapped yet. We stamp the user id into
  // subscription metadata at checkout, so recover from there and backfill the
  // customer id so future events match by customer.
  const userId = sub.metadata?.userId;
  if (!userId) return null;
  const byMetadata = await db.user.findUnique({ where: { id: userId } });
  if (byMetadata && customerId && byMetadata.stripeCustomerId !== customerId) {
    await db.user.update({ where: { id: byMetadata.id }, data: { stripeCustomerId: customerId } });
  }
  return byMetadata;
}

async function activateProFromSubscription(customerId: string, sub: Stripe.Subscription): Promise<void> {
  const user = await resolveUser(customerId, sub);
  if (!user) {
    console.error("Stripe webhook: no user for customer", customerId, "sub", sub.id);
    return;
  }
  const periodEnd = periodEndFromSubscription(sub);
  const isActive = sub.status === "active" || sub.status === "trialing";

  await db.user.update({
    where: { id: user.id },
    data: {
      plan: isActive ? "PRO" : "FREE",
      planExpiresAt: isActive ? periodEnd : null,
    },
  });

  await db.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: periodEnd ?? new Date(),
    },
    update: {
      stripeSubscriptionId: sub.id,
      status: sub.status,
      currentPeriodEnd: periodEnd ?? new Date(),
    },
  });
}

async function retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Extract the subscription id from an invoice. In Basil+ `invoice.subscription`
 * was removed; it now lives on parent.subscription_details or on line items.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice & { subscription?: string | { id: string } }): string | null {
  const direct = invoice.subscription;
  if (direct) return typeof direct === "string" ? direct : direct.id;

  const inv = invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
    lines?: { data?: Array<{ parent?: { subscription_item_details?: { subscription?: string | { id: string } } } }> };
  };
  const fromParent = inv.parent?.subscription_details?.subscription;
  if (fromParent) return typeof fromParent === "string" ? fromParent : fromParent.id;

  const fromLine = inv.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;
  if (fromLine) return typeof fromLine === "string" ? fromLine : fromLine.id;

  return null;
}

async function syncFromInvoice(
  invoice: Stripe.Invoice & { subscription?: string | { id: string } },
): Promise<void> {
  const subId = subscriptionIdFromInvoice(invoice);
  if (!subId) {
    console.error("Stripe webhook: invoice has no subscription", invoice.id);
    return;
  }
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? "";
  const sub = await retrieveSubscription(subId);
  await activateProFromSubscription(customerId, sub);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      // The session object is NOT a subscription: it has no period info and its
      // id is `cs_...`. Load the real subscription so we set the correct
      // customer, status, and period end.
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) break;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? "";
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const sub = await retrieveSubscription(subId);
      await activateProFromSubscription(customerId, sub);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
      await activateProFromSubscription(customerId, sub);
      break;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      // Renewals arrive as invoices; re-sync from the linked subscription.
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } };
      await syncFromInvoice(invoice);
      break;
    }

    case "invoice_payment.paid": {
      // Basil+ splits payment into a separate `invoice_payment` object that
      // only references the invoice id. Retrieve the invoice, then its sub.
      const payment = event.data.object as { invoice?: string | { id: string } };
      const invRef = payment.invoice;
      if (!invRef) break;
      const invoiceId = typeof invRef === "string" ? invRef : invRef.id;
      const invoice = (await stripe.invoices.retrieve(invoiceId)) as Stripe.Invoice & {
        subscription?: string | { id: string };
      };
      await syncFromInvoice(invoice);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? "";
      const user = await userByCustomer(customerId);
      if (!user) return;
      await db.user.update({ where: { id: user.id }, data: { plan: "FREE", planExpiresAt: null } });
      await db.subscription.updateMany({ where: { userId: user.id }, data: { status: sub.status } });
      break;
    }

    default:
      break;
  }
}
