import { NextResponse } from "next/server";
import { getCopticDayDataBatch } from "@/lib/coptic-api";

export async function GET(req: Request) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const data = await getCopticDayDataBatch(start, end);
    return NextResponse.json({
      message: `Cached ${Object.keys(data).length} days`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/coptic/cron] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
