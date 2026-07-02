import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LinkForm } from "./link-form";
import { LinkList } from "./link-list";

export default async function LinksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const links = await db.link.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="grid gap-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One smart URL per app — routed by device, with a QR code and stats.
        </p>
        <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
          <LinkForm isPro={user.plan === "PRO"} />
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Your links · {links.length}
        </h2>
        <LinkList links={links} appUrl={appUrl} />
      </section>
    </div>
  );
}
