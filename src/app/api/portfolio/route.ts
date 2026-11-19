import { NextResponse } from "next/server";
import { getUserPortfolio, getUserOrders } from "@/lib/market";
import { getCurrentUser } from "@/lib/auth";
import { seedMarketData } from "@/lib/seed";
import { getDb } from "@/lib/db";


export async function GET() {
  try {
    await seedMarketData();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (user.isManager) {
      return NextResponse.json({ success: false, message: "Manager accounts do not have a portfolio." }, { status: 403 });
    }

    const { getUserDividendHistory } = await import("@/lib/dividends");
    const db = getDb();

    const [portfolio, openOrders, dividendHistory, tradeHistoryRes] = await Promise.all([
      getUserPortfolio(user.id),
      getUserOrders(user.id),
      getUserDividendHistory(user.id),
      db.execute({
        sql: `
          SELECT t.id, t.price, t.quantity, t.created_at,
                 c.ticker, c.name as company_name,
                 CASE WHEN t.buyer_id = ? THEN 'BUY' ELSE 'SELL' END as side
          FROM trades t
          JOIN companies c ON t.company_id = c.id
          WHERE t.buyer_id = ? OR t.seller_id = ?
          ORDER BY t.created_at DESC
          LIMIT 100
        `,
        args: [user.id, user.id, user.id],
      }),
    ]);

    const tradeHistory = tradeHistoryRes.rows.map((r: any) => ({
      id: String(r.id),
      ticker: String(r.ticker),
      companyName: String(r.company_name),
      side: String(r.side) as "BUY" | "SELL",
      price: Number(r.price),
      quantity: Number(r.quantity),
      total: Math.round(Number(r.price) * Number(r.quantity) * 100) / 100,
      createdAt: String(r.created_at),
    }));

    const totalDividendsEarned = dividendHistory.reduce((sum, d) => sum + d.payoutAmount, 0);

    return NextResponse.json({
      success: true,
      user,
      portfolio,
      openOrders,
      dividendHistory,
      tradeHistory,
      totalDividendsEarned: Math.round(totalDividendsEarned * 100) / 100,
    });
  } catch (error: any) {
    console.error("API /api/portfolio error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
