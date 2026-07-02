import { drainEvents } from "@/lib/analytics-queue";
import { db } from "@/lib/db";

export async function flushAnalytics(batchMax: number): Promise<{ inserted: number }> {
  const events = await drainEvents(batchMax);
  if (events.length === 0) return { inserted: 0 };

  const slugs = [...new Set(events.map((e) => e.linkId))];
  const links = await db.link.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
  const bySlug = new Map(links.map((l) => [l.slug, l.id]));

  const rows = events
    .filter((e) => bySlug.has(e.linkId))
    .map((e) => ({
      linkId: bySlug.get(e.linkId)!, deviceType: e.deviceType, os: e.os, country: e.country,
      referrer: e.referrer, utmSource: e.utmSource, utmMedium: e.utmMedium,
      utmCampaign: e.utmCampaign, redirectedTo: e.redirectedTo, timestamp: new Date(e.timestamp),
    }));
  if (rows.length === 0) return { inserted: 0 };

  await db.analyticsEvent.createMany({ data: rows });
  return { inserted: rows.length };
}
