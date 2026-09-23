import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCopticDayDataBatch } from "@/lib/coptic-api";

/**
 * F0325 — re-fetch the next four weeks of Coptic readings.
 *
 * Two things were wrong with this, and the dangerous one was not the missing
 * button. It accepted *any* signed-in session, and it deleted all twenty-nine
 * days of cache before fetching anything: a servant pressing "try again" at the
 * altar because today's readings had not arrived, on a morning when the upstream
 * service was down, was left with four weeks of nothing instead of one stale day.
 * A retry that can make things very much worse is not a retry.
 *
 * Now: administrators only, and each day is replaced rather than cleared first.
 * Marking the rows stale is what forces the re-fetch — the rows stay exactly
 * where they are, so a day whose fetch fails keeps the reading it already had.
 */
export async function POST() {
  const session = await auth();
  const isAdmin =
    session?.user?.kind === "site" ||
    (session?.user?.kind === "portal" && session.user.role === "ADMIN");
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const dates: string[] = [];
    const current = new Date(start + "T12:00:00Z");
    const endDate = new Date(end + "T12:00:00Z");
    while (current <= endDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Expire rather than delete. `getCopticDayDataBatch` re-fetches anything
    // older than its cache window and, when a fetch fails, falls back to the row
    // that is still sitting there — which is the whole point of not deleting.
    await prisma.copticDayCache.updateMany({
      where: { id: { in: dates } },
      data: { fetchedAt: new Date(0) },
    });

    const data = await getCopticDayDataBatch(start, end);
    const withReadings = Object.values(data).filter(
      (d) => Array.isArray(d.readings) && d.readings.length > 0
    ).length;
    return NextResponse.json({
      message: `Refreshed ${Object.keys(data).length} days; ${withReadings} have readings.`,
      days: Object.keys(data).length,
      withReadings,
    });
  } catch (error) {
    console.error("[api/coptic/refresh] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh coptic data" },
      { status: 500 }
    );
  }
}
