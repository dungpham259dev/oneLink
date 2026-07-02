import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="flex items-center gap-6 border-b p-4">
        <Link href="/" className="font-bold">OneLink</Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/support">Support</Link>
        </nav>
        <Link href="/app/links" className="ml-auto text-sm font-medium">My OneLinks</Link>
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
      <footer className="border-t p-6 text-center text-sm text-muted-foreground">© OneLink</footer>
    </div>
  );
}
