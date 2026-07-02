import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { qrConfigSchema } from "@/lib/validation/qr";
import { QrStudio } from "./qr-studio";

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const link = await db.link.findFirst({ where: { id, userId: user.id }, include: { qrConfig: true } });
  if (!link) notFound();
  const initial = qrConfigSchema.parse(link.qrConfig ?? {});
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${link.slug}`;
  return (
    <div className="grid gap-8">
      <div>
        <Link
          href="/app/links"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All links
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          QR code · {link.name ?? link.slug}
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">/r/{link.slug}</p>
      </div>
      <QrStudio linkId={id} url={url} initial={initial} isPro={user.plan === "PRO"} />
    </div>
  );
}
