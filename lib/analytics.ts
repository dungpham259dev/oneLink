import { db } from "@/lib/db";

type Counts = Record<string, number>;

async function group(linkId: string, from: Date, to: Date, field: "deviceType" | "country" | "referrer" | "redirectedTo"): Promise<Counts> {
  const rows = await (db.analyticsEvent.groupBy as any)({
    by: [field],
    where: { linkId, timestamp: { gte: from, lte: to } },
    _count: { _all: true },
  }) as Array<Record<string, unknown> & { _count: { _all: number } }>;
  const out: Counts = {};
  for (const row of rows) out[String(row[field] ?? "unknown")] = row._count._all;
  return out;
}

export async function getLinkStats(linkId: string, from: Date, to: Date) {
  const total = await db.analyticsEvent.count({ where: { linkId, timestamp: { gte: from, lte: to } } });
  const [byDevice, byCountry, byReferrer, byTarget] = await Promise.all([
    group(linkId, from, to, "deviceType"),
    group(linkId, from, to, "country"),
    group(linkId, from, to, "referrer"),
    group(linkId, from, to, "redirectedTo"),
  ]);
  return { total, byDevice, byCountry, byReferrer, byTarget };
}
