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
    <div className="grid gap-8">
      <section>
        <h1 className="mb-4 text-xl font-semibold">Create a Onelink</h1>
        <LinkForm isPro={user.plan === "PRO"} />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Your Onelinks</h2>
        <LinkList links={links} appUrl={appUrl} />
      </section>
    </div>
  );
}
