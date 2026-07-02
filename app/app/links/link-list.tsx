"use client";
import Link from "next/link";
import { useTransition } from "react";
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
    return <p className="text-sm text-muted-foreground">No links yet. Create one above.</p>;
  }

  return (
    <ul className="divide-y">
      {links.map((l) => (
        <li key={l.id} className="flex items-center gap-3 py-3">
          <div className="flex-1">
            <div className="font-medium">{l.name ?? l.slug}</div>
            <a className="text-sm text-blue-600" href={`${appUrl}/r/${l.slug}`}>
              {appUrl}/r/{l.slug}
            </a>
          </div>
          <Button variant="outline" size="sm" onClick={() => handleCopy(l.slug)}>
            Copy
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/links/${l.id}/qr`}>QR</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/links/${l.id}/stats`}>Stats</Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => handleDelete(l.id)}
          >
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}
