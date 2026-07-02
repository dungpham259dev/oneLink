import { NextRequest, NextResponse } from "next/server";
import { flushAnalytics } from "@/lib/flush";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return new NextResponse("Unauthorized", { status: 401 });
  const result = await flushAnalytics(1000);
  return NextResponse.json(result);
}
