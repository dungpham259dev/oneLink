import Link from "next/link";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-8 px-6">
          <Link href="/" className="transition-opacity hover:opacity-70">
            <Wordmark />
          </Link>
          <nav className="hidden gap-6 text-sm text-muted-foreground sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button asChild size="sm" className="ml-auto rounded-full px-4">
            <Link href="/app/links">Open dashboard</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6">{children}</main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
          <Wordmark />
          <nav className="flex gap-6">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span>© {new Date().getFullYear()} OneLink</span>
        </div>
      </footer>
    </div>
  );
}
