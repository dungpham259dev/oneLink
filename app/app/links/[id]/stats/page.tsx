import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getLinkStats } from "@/lib/analytics";
import { PLAN_LIMITS } from "@/lib/plans";

function StatCard({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const max = entries.length > 0 ? entries[0][1] : 0;
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground/70">No data yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {entries.map(([k, v]) => (
            <li key={k} className="grid gap-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="truncate">{k}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{v}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max > 0 ? (v / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
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
          {link.name ?? link.slug}
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">/r/{link.slug}</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">Total requests · last 30 days</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{stats.total}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StatCard title="Devices" data={stats.byDevice} />
        {full && <StatCard title="Countries" data={stats.byCountry} />}
        {full && <StatCard title="Referrers" data={stats.byReferrer} />}
        {full && <StatCard title="Redirect target" data={stats.byTarget} />}
      </div>

      {!full && (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          <Lock className="size-4" />
          <span>
            Country, referrer, and target breakdowns are on Pro.{" "}
            <Link href="/app/billing" className="font-medium text-brand hover:underline">
              Upgrade
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}
