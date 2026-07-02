import { getCurrentUser } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { BillingButtons } from "./billing-buttons";

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }
  const isPro = user.plan === "PRO";
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Billing</h1>
      <p>Current plan: <strong>{user.plan}</strong></p>
      <BillingButtons isPro={isPro} />
    </div>
  );
}
