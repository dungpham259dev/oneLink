import { getCurrentUser } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { BillingButtons } from "./billing-buttons";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const isPro = user.plan === "PRO";
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <div className="mt-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {isPro ? "Pro" : "Free"}
            </p>
          </div>
          <Badge variant={isPro ? "default" : "secondary"}>{user.plan}</Badge>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {isPro
            ? "You have unlimited links, custom slugs, branded QR codes, and full analytics."
            : "Upgrade to Pro for unlimited links, custom slugs, QR logos and gradients, and full analytics."}
        </p>
        <div className="mt-6">
          <BillingButtons isPro={isPro} />
        </div>
      </div>
    </div>
  );
}
