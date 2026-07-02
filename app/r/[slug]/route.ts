import { NextRequest, NextResponse } from "next/server";
import { getLinkCache } from "@/lib/link-cache";
import { detectDevice } from "@/lib/device";
import { resolveDestination } from "@/lib/resolve";
import { parseUtm } from "@/lib/utm";
import { enqueueEvent } from "@/lib/analytics-queue";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const config = await getLinkCache(slug);
  if (!config) {
    return new NextResponse("Link not found", { status: 404 });
  }

  const ua = req.headers.get("user-agent") ?? "";
  const { device, os } = detectDevice(ua);
  const query = req.nextUrl.search.replace(/^\?/, "");
  const { url, target } = resolveDestination({ ...config, slug }, device, query);

  const utm = parseUtm(req.nextUrl.searchParams);
  const country = req.headers.get("x-vercel-ip-country") ?? null;
  const referrer = req.headers.get("referer");

  // Fire-and-forget: never block the redirect on analytics, and never let a
  // queue failure break the redirect.
  void enqueueEvent({
    linkId: slug,
    deviceType: device,
    os,
    country,
    referrer,
    ...utm,
    redirectedTo: target,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  if (url) {
    return NextResponse.redirect(url, 302);
  }

  return new NextResponse("This link has no destination configured.", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}
