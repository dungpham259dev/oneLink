"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createCheckoutSession, createPortalSession } from "./actions";

export function BillingButtons({ isPro }: { isPro: boolean }) {
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ url: string } | { error: string }>) =>
    start(async () => { const r = await fn(); if ("url" in r) window.location.href = r.url; else toast.error(r.error); });
  return isPro
    ? <Button disabled={pending} onClick={() => go(createPortalSession)}>Manage subscription</Button>
    : <Button disabled={pending} onClick={() => go(createCheckoutSession)}>Upgrade to Pro — $10/mo</Button>;
}
