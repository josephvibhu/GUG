import { NextResponse } from "next/server";
import { getAllCompanies } from "@/lib/market";
import { seedMarketData } from "@/lib/seed";
import { getCurrentUser } from "@/lib/auth";
import { getMarketSchedule } from "@/lib/marketHours";

export async function GET() {
  try {
    await seedMarketData();
    const [companies, user, marketSchedule] = await Promise.all([
      getAllCompanies(),
      getCurrentUser(),
      getMarketSchedule(),
    ]);

    return NextResponse.json({
      success: true,
      companies,
      user,
      marketSchedule,
    });
  } catch (error: any) {
    console.error("API /api/market error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

