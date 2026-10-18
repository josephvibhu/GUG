import { NextResponse } from "next/server";
import { getCompanyByTicker, getOrderBook, getRecentTrades, getCandles, getUserPortfolio, getUserOrders } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { seedMarketData } from "@/lib/seed";
import { getMarketSchedule } from "@/lib/marketHours";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    await seedMarketData();
    const { ticker } = await params;
    const company = await getCompanyByTicker(ticker);

    if (!company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    const [orderBook, recentTrades, candles, user, marketSchedule] = await Promise.all([
      getOrderBook(company.id),
      getRecentTrades(company.id, 25),
      getCandles(company.id),
      getCurrentUser(),
      getMarketSchedule(),
    ]);

    let userHolding = null;
    let userOrders: any[] = [];

    if (user) {
      const portfolio = await getUserPortfolio(user.id);
      userHolding = portfolio.positions.find((p) => p.companyId === company.id) || null;
      userOrders = await getUserOrders(user.id, company.id);
    }

    return NextResponse.json({
      success: true,
      company,
      orderBook,
      recentTrades,
      candles,
      user,
      userHolding,
      userOrders,
      marketSchedule,
    });
  } catch (error: any) {
    console.error("API /api/market/[ticker] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
