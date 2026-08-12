import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCopticDayDataBatch } from "@/lib/coptic-api";
import { materializeWeeklyServices } from "@/lib/weekly-services-materialize";

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

    // Auto-populate the rolling 4-week window from the enabled weekly services.
    // Runs daily with no admin present, so newly-in-range weeks fill themselves.
    // Idempotent — creates only missing instances.
    const materialized = await materializeWeeklyServices({ now }).catch((e) => {
      console.error("[api/coptic/cron] materialize failed:", e);
      return { created: 0, skipped: null as null };
    });

    if (materialized.created > 0) {
      revalidatePath("/");
      revalidatePath("/schedule");
      revalidatePath("/admin/dashboard");
    }

    return NextResponse.json({
      message: `Cached ${Object.keys(data).length} days; materialized ${materialized.created} weekly-service events`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/coptic/cron] Error:", error);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
