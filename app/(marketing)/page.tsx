import Link from "next/link";
import { ArrowRight, Apple, Play, Globe, QrCode, BarChart3, Split } from "lucide-react";
import { Button } from "@/components/ui/button";

const routes = [
  { icon: Apple, label: "iPhone", target: "App Store" },
  { icon: Play, label: "Android", target: "Google Play" },
  { icon: Globe, label: "Desktop", target: "Your website" },
];

const features = [
  {
    icon: Split,
    title: "Device-aware routing",
    body: "One URL reads the visitor's device and sends iPhones to the App Store, Androids to Google Play, and everyone else to your site.",
  },
  {
    icon: QrCode,
    title: "Branded QR codes",
    body: "Generate a QR code for every link — with your logo, your colors, ready for print or packaging.",
  },
  {
    icon: BarChart3,
    title: "Analytics that matter",
    body: "See scans and clicks by device, country, and referrer, so you know where your installs come from.",
  },
];

export default function Home() {
  return (
    <div className="pb-24">
      {/* Hero */}
      <section className="flex flex-col items-center pt-24 pb-16 text-center sm:pt-32">
        <h1 className="max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
          One link.
          <br />
          Every store.
        </h1>
        <p className="mt-6 max-w-md text-balance text-lg text-muted-foreground">
          A smart link that reads the visitor&rsquo;s device and opens your app in the right
          store — with a QR code to match.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/app/links">
              Create your OneLink
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="rounded-full px-6 text-muted-foreground">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>

        {/* Routing demo — the signature moment */}
        <div className="mt-20 w-full max-w-lg">
          <div className="mx-auto w-fit rounded-full border bg-card px-5 py-2.5 font-mono text-sm shadow-sm">
            onelink.to/<span className="font-semibold text-brand">your-app</span>
          </div>
          <div aria-hidden="true" className="mx-auto my-3 h-8 w-px bg-border" />
          <div className="grid grid-cols-3 gap-3">
            {routes.map((r) => (
              <div
                key={r.label}
                className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-3 py-5 shadow-sm"
              >
                <r.icon className="size-5 text-brand" strokeWidth={1.75} />
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.target}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-4xl gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="bg-card p-8">
            <f.icon className="size-5 text-brand" strokeWidth={1.75} />
            <h2 className="mt-4 font-medium">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mt-24 flex flex-col items-center text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Your app deserves one clean link.
        </h2>
        <Button asChild size="lg" className="mt-6 rounded-full px-6">
          <Link href="/app/links">
            Get started free
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </div>
  );
}
