import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/lib/plans";

const rows: { label: string; key: keyof typeof PLAN_LIMITS.FREE }[] = [
  { label: "Custom slug", key: "customSlug" },
  { label: "QR logo", key: "qrLogo" },
  { label: "QR gradient", key: "qrGradient" },
  { label: "Desktop links", key: "desktopLinks" },
  { label: "Parameter forwarding", key: "parameterForwarding" },
  { label: "Full analytics", key: "fullAnalytics" },
];

function Cell({ value }: { value: boolean | number | null }) {
  if (value === true) return <Check className="size-4 text-brand" aria-label="Included" />;
  if (value === false)
    return <Minus className="size-4 text-muted-foreground/50" aria-label="Not included" />;
  return <span className="text-sm">{value === null ? "Unlimited" : String(value)}</span>;
}

function PlanCard({
  name,
  price,
  note,
  planKey,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  note: string;
  planKey: "FREE" | "PRO";
  cta: string;
  highlighted?: boolean;
}) {
  const limits = PLAN_LIMITS[planKey];
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card p-8 shadow-sm ${
        highlighted ? "border-brand ring-1 ring-brand" : ""
      }`}
    >
      <h2 className="font-medium">{name}</h2>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </div>
      <ul className="mt-8 grid gap-3 text-sm">
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Links</span>
          <Cell value={limits.maxLinks} />
        </li>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <Cell value={limits[r.key]} />
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={highlighted ? "default" : "outline"}
        className="mt-8 w-full rounded-full"
      >
        <Link href="/app/links">{cta}</Link>
      </Button>
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="py-20">
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        Simple pricing
      </h1>
      <p className="mt-3 text-center text-muted-foreground">
        Start free. Upgrade when your app takes off.
      </p>
      <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-2">
        <PlanCard name="Free" price="$0" note="forever" planKey="FREE" cta="Start free" />
        <PlanCard
          name="Pro"
          price="$10"
          note="/month"
          planKey="PRO"
          cta="Go Pro"
          highlighted
        />
      </div>
    </div>
  );
}
