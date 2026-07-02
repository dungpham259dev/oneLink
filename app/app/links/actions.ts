"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { canCreateLink, PLAN_LIMITS } from "@/lib/plans";
import { generateSlug, isValidCustomSlug } from "@/lib/slug";
import { putLinkCache, deleteLinkCache } from "@/lib/link-cache";
import { linkInputSchema, type LinkInput } from "@/lib/validation/link";
import type { LinkConfig } from "@/lib/resolve";

type Result = { ok: true; slug?: string } | { ok: false; error: string };

function toLinkConfig(link: {
  slug: string; iosUrl: string | null; ipadUrl: string | null; androidUrl: string | null;
  huaweiUrl: string | null; windowsUrl: string | null; macUrl: string | null;
  fallbackUrl: string | null; parameterForwarding: boolean;
}): LinkConfig {
  return { slug: link.slug, iosUrl: link.iosUrl, ipadUrl: link.ipadUrl, androidUrl: link.androidUrl,
    huaweiUrl: link.huaweiUrl, windowsUrl: link.windowsUrl, macUrl: link.macUrl,
    fallbackUrl: link.fallbackUrl, parameterForwarding: link.parameterForwarding };
}

async function uniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const s = generateSlug();
    if (!(await db.link.findFirst({ where: { slug: s } }))) return s;
  }
  return generateSlug(8);
}

export async function createLink(input: LinkInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;

  const count = await db.link.count({ where: { userId: user.id } });
  if (!canCreateLink(user.plan, count)) return { ok: false, error: "Link limit reached for your plan" };

  let slug: string;
  if (data.customSlug) {
    if (!PLAN_LIMITS[user.plan].customSlug) return { ok: false, error: "Custom slugs require Pro" };
    if (!isValidCustomSlug(data.customSlug)) return { ok: false, error: "Invalid slug format" };
    if (await db.link.findFirst({ where: { slug: data.customSlug } }))
      return { ok: false, error: "Slug already taken" };
    slug = data.customSlug;
  } else {
    slug = await uniqueSlug();
  }

  if (!PLAN_LIMITS[user.plan].desktopLinks) { data.windowsUrl = undefined; data.macUrl = undefined; }
  if (!PLAN_LIMITS[user.plan].parameterForwarding) data.parameterForwarding = false;

  const link = await db.link.create({ data: {
    userId: user.id, slug, name: data.name, iosUrl: data.iosUrl, ipadUrl: data.ipadUrl,
    androidUrl: data.androidUrl, huaweiUrl: data.huaweiUrl, windowsUrl: data.windowsUrl,
    macUrl: data.macUrl, fallbackUrl: data.fallbackUrl, parameterForwarding: data.parameterForwarding,
  }});
  await putLinkCache(toLinkConfig(link));
  revalidatePath("/app/links");
  return { ok: true, slug };
}

export async function updateLink(id: string, input: LinkInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const existing = await db.link.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "Not found" };
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const data = parsed.data;
  if (!PLAN_LIMITS[user.plan].desktopLinks) { data.windowsUrl = undefined; data.macUrl = undefined; }
  if (!PLAN_LIMITS[user.plan].parameterForwarding) data.parameterForwarding = false;

  const link = await db.link.update({ where: { id }, data: {
    name: data.name, iosUrl: data.iosUrl, ipadUrl: data.ipadUrl, androidUrl: data.androidUrl,
    huaweiUrl: data.huaweiUrl, windowsUrl: data.windowsUrl, macUrl: data.macUrl,
    fallbackUrl: data.fallbackUrl, parameterForwarding: data.parameterForwarding,
  }});
  await putLinkCache(toLinkConfig(link));
  revalidatePath("/app/links");
  return { ok: true, slug: link.slug };
}

export async function deleteLink(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Unauthorized" };
  const existing = await db.link.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { ok: false, error: "Not found" };
  await db.link.delete({ where: { id } });
  await deleteLinkCache(existing.slug);
  revalidatePath("/app/links");
  return { ok: true };
}
