import { NextResponse } from "next/server";
import { getUserPortfolio, getUserOrders } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { seedMarketData } from "@/lib/seed";


export async function GET() {
  try {
    await seedMarketData();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { getUserDividendHistory } = await import("@/lib/dividends");
    const [portfolio, openOrders, dividendHistory] = await Promise.all([
      getUserPortfolio(user.id),
      getUserOrders(user.id),
      getUserDividendHistory(user.id),
    ]);

    const totalDividendsEarned = dividendHistory.reduce((sum, d) => sum + d.payoutAmount, 0);

    return NextResponse.json({
      success: true,
      user,
      portfolio,
      openOrders,
      dividendHistory,
      totalDividendsEarned: Math.round(totalDividendsEarned * 100) / 100,
    });
  } catch (error: any) {
    console.error("API /api/portfolio error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
