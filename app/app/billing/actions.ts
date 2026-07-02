"use server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const APP = process.env.NEXT_PUBLIC_APP_URL!;

async function ensureCustomer(user: { id: string; email: string; stripeCustomerId: string | null }): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  const customer = await ensureCustomer(user);
  const session = await stripe.checkout.sessions.create({
    customer, mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: `${APP}/app/billing?success=1`,
    cancel_url: `${APP}/app/billing?canceled=1`,
  });
  if (!session.url) return { error: "Could not create checkout session" };
  return { url: session.url };
}

export async function createPortalSession(): Promise<{ url: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };
  if (!user.stripeCustomerId) return { error: "No subscription" };
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId, return_url: `${APP}/app/billing`,
  });
  return { url: session.url };
}
