import { redis } from "@/lib/redis";
import type { LinkConfig } from "@/lib/resolve";

export function cacheKey(slug: string): string { return `link:${slug}`; }

export async function putLinkCache(config: LinkConfig): Promise<void> {
  await redis.set(cacheKey(config.slug), config);
}

export async function getLinkCache(slug: string): Promise<LinkConfig | null> {
  return (await redis.get<LinkConfig>(cacheKey(slug))) ?? null;
}

export async function deleteLinkCache(slug: string): Promise<void> {
  await redis.del(cacheKey(slug));
}
