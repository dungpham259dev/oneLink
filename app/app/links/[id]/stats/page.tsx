import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getLinkStats } from "@/lib/analytics";
import { PLAN_LIMITS } from "@/lib/plans";

function Table({ title, data }: { title: string; data: Record<string, number> }) {
  return (
    <div className="rounded border p-4">
      <h3 className="mb-2 font-medium">{title}</h3>
      <ul className="text-sm">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default async function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const link = await db.link.findFirst({ where: { id, userId: user.id } });
  if (!link) notFound();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const stats = await getLinkStats(id, from, to);
  const full = PLAN_LIMITS[user.plan].fullAnalytics;
  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Stats · {link.name ?? link.slug}</h1>
      <div className="text-3xl font-bold">{stats.total} <span className="text-base font-normal text-muted-foreground">total requests (30d)</span></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Table title="Devices" data={stats.byDevice} />
        {full && <Table title="Countries" data={stats.byCountry} />}
        {full && <Table title="Referrers" data={stats.byReferrer} />}
        {full && <Table title="Redirect target" data={stats.byTarget} />}
      </div>
      {!full && <p className="text-sm text-muted-foreground">Upgrade to Pro for country, referrer, and UTM stats.</p>}
    </div>
  );
}
