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

    const { getEarningsReports, getNextFridayUtc } = await import("@/lib/dividends");
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    const [earningsReports, shRes] = await Promise.all([
      getEarningsReports(company.id),
      db.execute({
        sql: `
          SELECT p.shares, u.id as user_id, u.username, u.display_name, u.account_type, u.state_realm_name, u.state_crest
          FROM portfolios p
          JOIN users u ON p.user_id = u.id
          WHERE p.company_id = ? AND p.shares > 0
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
      accountType: (r.account_type as "CITIZEN" | "STATE") || "CITIZEN",
      stateRealmName: r.state_realm_name ? String(r.state_realm_name) : undefined,
      stateCrest: r.state_crest ? String(r.state_crest) : undefined,
      shares: Number(r.shares),
      equityPercent: Number(company.totalShares) > 0 ? Math.round((Number(r.shares) / Number(company.totalShares)) * 10000) / 100 : 0,
    }));

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
      earningsReports,
      nextFriday: getNextFridayUtc().toISOString(),
      shareholders,
    });
  } catch (error: any) {
    console.error("API /api/market/[ticker] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
