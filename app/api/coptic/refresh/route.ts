import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCopticDayDataBatch } from "@/lib/coptic-api";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Refresh cache for next 28 days
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Force refresh by clearing cache first
    const { prisma } = await import("@/lib/prisma");
    const dates: string[] = [];
    const current = new Date(start + "T12:00:00Z");
    const endDate = new Date(end + "T12:00:00Z");
    while (current <= endDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    await prisma.copticDayCache.deleteMany({
      where: { id: { in: dates } },
    });

    const data = await getCopticDayDataBatch(start, end);
    return NextResponse.json({
      message: `Refreshed ${Object.keys(data).length} days`,
    });
  } catch (error) {
    console.error("[api/coptic/refresh] Error:", error);
    return NextResponse.json(
      { error: "Failed to refresh coptic data" },
      { status: 500 }
    );
  }
}
