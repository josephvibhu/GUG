import { NextResponse } from "next/server";
import { getCompanyByTicker, getOrderBook, getRecentTrades, getUserHolding, getUserOrders } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { seedMarketData } from "@/lib/seed";
import { getMarketSchedule } from "@/lib/marketHours";
import { getCompanyDiscordHandle } from "@/lib/companyTreasury";

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

    // Chart candles come from /api/market/[ticker]/candles, fetched only when the chart needs them
    const [orderBook, recentTrades, user, marketSchedule] = await Promise.all([
      getOrderBook(company.id),
      getRecentTrades(company.id, 30),
      getCurrentUser(),
      getMarketSchedule(),
    ]);

    const { getEarningsReports, getNextFridayUtc } = await import("@/lib/dividends");
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    const [earningsReports, shRes] = await Promise.all([
      getEarningsReports(company.id),
      db.execute({
        sql: `
          SELECT p.shares, u.id as user_id, u.username, u.display_name
          FROM portfolios p
          JOIN users u ON p.user_id = u.id
          WHERE p.company_id = ? AND p.shares > 0 AND u.id NOT IN ('usr_treasury', 'usr_house')
          ORDER BY p.shares DESC
          LIMIT 12
        `,
        args: [company.id],
      }),
    ]);

    const shareholders = shRes.rows.map((r: any) => ({
      userId: String(r.user_id),
      username: String(r.username),
      displayName: String(r.display_name),
      shares: Number(r.shares),
      equityPercent: Number(company.totalShares) > 0 ? Math.round((Number(r.shares) / Number(company.totalShares)) * 10000) / 100 : 0,
    }));

    let userHolding = null;
    let userOrders: any[] = [];
    // Founder-only details for the Founder tab (the Discord contact is for the operator, not public)
    let founderView: { discordHandle: string } | null = null;

    if (user) {
      [userHolding, userOrders] = await Promise.all([
        getUserHolding(user.id, company.id),
        getUserOrders(user.id, company.id),
      ]);
      if (user.id === company.creatorId || user.isAdmin) {
        founderView = { discordHandle: await getCompanyDiscordHandle(company.id) };
      }
    }

    return NextResponse.json({
      success: true,
      company,
      orderBook,
      recentTrades,
      lastTradeId: recentTrades[0]?.id || null,
      serverNow: Date.now(),
      user,
      userHolding,
      userOrders,
      marketSchedule,
      earningsReports,
      nextFriday: getNextFridayUtc().toISOString(),
      shareholders,
      founderView,
    });
  } catch (error: any) {
    console.error("API /api/market/[ticker] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
