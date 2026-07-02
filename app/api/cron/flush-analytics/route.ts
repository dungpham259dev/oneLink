import { NextRequest, NextResponse } from "next/server";
import { flushAnalytics } from "@/lib/flush";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse("Unauthorized", { status: 401 });
  const result = await flushAnalytics(1000);
  return NextResponse.json(result);
}
