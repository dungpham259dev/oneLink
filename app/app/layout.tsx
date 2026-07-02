import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto max-w-5xl p-6">
      <nav className="mb-6 flex gap-4 border-b pb-3 text-sm">
        <Link href="/app/links">Links</Link>
        <Link href="/app/billing">Billing</Link>
        <span className="ml-auto text-muted-foreground">
          {user.email} · {user.plan}
        </span>
      </nav>
      {children}
    </div>
  );
}
