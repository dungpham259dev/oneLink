"use server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { qrConfigSchema, type QrConfigInput } from "@/lib/validation/qr";

type Result = { ok: true } | { ok: false; error: string };

export async function saveQrConfig(linkId: string, input: QrConfigInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const link = await db.link.findFirst({ where: { id: linkId, userId: user.id } });
  if (!link) return { ok: false, error: "Not found" };
  const parsed = qrConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid QR config" };
  const data = parsed.data;
  const sanitized = {
    ...data,
    logoUrl: PLAN_LIMITS[user.plan].qrLogo ? data.logoUrl : null,
    gradient: PLAN_LIMITS[user.plan].qrGradient
      ? (data.gradient ?? Prisma.JsonNull)
      : Prisma.JsonNull,
  };

  await db.qrConfig.upsert({
    where: { linkId },
    create: { linkId, ...sanitized },
    update: { ...sanitized },
  });
  revalidatePath(`/app/links/${linkId}/qr`);
  return { ok: true };
}
