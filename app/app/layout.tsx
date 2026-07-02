import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { Wordmark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { AppNav } from "./app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
          <Link href="/" className="transition-opacity hover:opacity-70">
            <Wordmark />
          </Link>
          <AppNav />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <Badge variant={user.plan === "PRO" ? "default" : "secondary"}>{user.plan}</Badge>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
