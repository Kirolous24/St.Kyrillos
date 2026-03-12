import { NextResponse } from "next/server";
import { getCopticDayDataBatch } from "@/lib/coptic-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    const data = await getCopticDayDataBatch(start, end);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[api/coptic] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch coptic data" },
      { status: 500 }
    );
  }
}
