import { NextResponse } from "next/server";
import { getAllCompanies, getSparklines } from "@/lib/market";
import { seedMarketData } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";
import { getMarketSchedule } from "@/lib/marketHours";

export async function GET() {
  try {
    await seedMarketData();
    const [companies, user, marketSchedule, sparklines] = await Promise.all([
      getAllCompanies(),
      getCurrentUser(),
      getMarketSchedule(),
      getSparklines(),
    ]);

    return NextResponse.json({
      success: true,
      companies,
      user,
      marketSchedule,
      sparklines,
      serverNow: Date.now(),
    });
  } catch (error) {
    console.error("API /api/market error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
