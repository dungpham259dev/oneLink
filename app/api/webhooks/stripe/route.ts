import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/webhook-handler";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }
  await handleStripeEvent(event);
  return NextResponse.json({ received: true });
}
