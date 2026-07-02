import { notFound } from "next/navigation";
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
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">QR Code · {link.name ?? link.slug}</h1>
      <QrStudio linkId={id} url={url} initial={initial} isPro={user.plan === "PRO"} />
    </div>
  );
}
