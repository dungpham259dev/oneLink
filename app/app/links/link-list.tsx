"use client";
import Link from "next/link";
import { useTransition } from "react";
import { Copy, QrCode, BarChart3, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteLink } from "./actions";

type Row = { id: string; slug: string; name: string | null };

export function LinkList({ links, appUrl }: { links: Row[]; appUrl: string }) {
  const [pending, start] = useTransition();

  const handleDelete = (id: string) => {
    start(async () => {
      const r = await deleteLink(id);
      if (r.ok) toast.success("Link deleted");
      else toast.error(r.error);
    });
  };

  const handleCopy = (slug: string) => {
    const url = `${appUrl}/r/${slug}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Failed to copy"));
  };

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed py-16 text-center">
        <Link2 className="size-6 text-muted-foreground/50" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          No links yet — create your first one above.
        </p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {links.map((l, i) => (
        <li
          key={l.id}
          className={`flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap ${
            i > 0 ? "border-t" : ""
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{l.name ?? l.slug}</div>
            <a
              className="truncate font-mono text-xs text-brand hover:underline"
              href={`${appUrl}/r/${l.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              {appUrl.replace(/^https?:\/\//, "")}/r/{l.slug}
            </a>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopy(l.slug)}
              aria-label="Copy link"
            >
              <Copy className="size-4" />
              <span className="hidden sm:inline">Copy</span>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/app/links/${l.id}/qr`} aria-label="QR code">
                <QrCode className="size-4" />
                <span className="hidden sm:inline">QR</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/app/links/${l.id}/stats`} aria-label="Stats">
                <BarChart3 className="size-4" />
                <span className="hidden sm:inline">Stats</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              disabled={pending}
              onClick={() => handleDelete(l.id)}
              aria-label="Delete link"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
