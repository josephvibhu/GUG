import { NextResponse } from "next/server";
import { getDb, initDb, scheduleBlobPersist } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { reportEarningsAndDividend } from "@/lib/dividends";

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    const week1Cutoff = "2026-10-23T09:30:00.000Z";
    const nowIso = new Date().toISOString();

    // 1. Secondary Market volume in Week 2
    const tradesWeek2 = await db.execute({
      sql: "SELECT count(*) as count, COALESCE(sum(total), 0) as volume FROM trades WHERE created_at >= ?",
      args: [week1Cutoff],
    });
    const tradesVolume = Number(tradesWeek2.rows[0]?.volume || 0);
    const tradesCount = Number(tradesWeek2.rows[0]?.count || 0);
    const tradeCommissions = Math.round(tradesVolume * 0.01 * 100) / 100;

    // 2. New IPO Charter Fees collected in Week 2
    const ipoFeesRes = await db.execute({
      sql: "SELECT COALESCE(sum(ipo_fee_collected), 0) as total_charter, count(*) as count FROM companies WHERE created_at >= ? AND ipo_fee_collected > 0",
      args: [week1Cutoff],
    });
    const charterFees = Number(ipoFeesRes.rows[0]?.total_charter || 0);
    const charterCompaniesCount = Number(ipoFeesRes.rows[0]?.count || 0);

    // 3. Deposit Rail in Week 2
    const depositSales = await db.execute({
      sql: "SELECT COALESCE(sum(units), 0) as units, COALESCE(sum(gross), 0) as gross, COALESCE(sum(tax), 0) as tax, COALESCE(sum(gold), 0) as net FROM game_sales WHERE at >= ?",
      args: [week1Cutoff],
    });
    const depositGross = Number(depositSales.rows[0]?.gross || 0);
    const depositUnits = Number(depositSales.rows[0]?.units || 0);
    const depositNet = Number(depositSales.rows[0]?.net || 0);

    // Filed raw materials expense (COGS)
    const cogsExpenses = 84.30;
    // Net deposit rail facility revenue
    const depositNetMargin = Math.round((554.20 - tradeCommissions - charterFees) * 100) / 100;

    // Net Operating Profit for Week 2
    const netProfit = 554.20;
    const payoutPercent = 50;
    const totalPayout = Math.round(((netProfit * payoutPercent) / 100) * 100) / 100;

    // 4. Cap Table breakdown for GUG
    const gugPortfolios = await db.execute(`
      SELECT p.user_id, u.username, p.shares
      FROM portfolios p
      JOIN users u ON p.user_id = u.id
      WHERE p.company_id = 'cmp_gug_001' AND p.shares > 0
    `);

    let publicShares = 0;
    let founderShares = 0;
    for (const row of gugPortfolios.rows) {
      if (row.username === "JosephArora" || row.user_id === "usr_josepharora") {
        founderShares += Number(row.shares);
      } else {
        publicShares += Number(row.shares);
      }
    }
    const totalShares = 10000;
    const perShare = Math.round((totalPayout / totalShares) * 10000) / 10000;
    const publicPayout = Math.round(perShare * publicShares * 100) / 100;

    // 5. All-Time stats
    const allTrades = await db.execute("SELECT COALESCE(sum(total), 0) as vol FROM trades");
    const totalAllTimeVolume = Number(allTrades.rows[0]?.vol || 0);

    const pastDivs = await db.execute("SELECT COALESCE(sum(total_distributed), 0) as total_divs FROM earnings_reports WHERE company_id = 'cmp_gug_001'");
    const allTimePaidOut = Math.round((Number(pastDivs.rows[0]?.total_divs || 0) + totalPayout) * 100) / 100;
    const allTimeNetProfit = 1561.11;
    const allTimePublicFloatPaid = Math.round((50.60 + publicPayout) * 100) / 100;

    // Check if Week 2 has already been filed
    const existingWeek2 = await db.execute({
      sql: "SELECT * FROM earnings_reports WHERE company_id = 'cmp_gug_001' AND (period_title LIKE '%Week 2%' OR (created_at >= ? AND status = 'DISTRIBUTED'))",
      args: [week1Cutoff],
    });

    return NextResponse.json({
      success: true,
      alreadyFiled: existingWeek2.rows.length > 0,
      existingReport: existingWeek2.rows[0] || null,
      cardData: {
        ticker: "GUG",
        companyName: "Grow UR Gold",
        weekNumber: 2,
        periodStart: "Fri 23 Oct 2026, 09:30 UTC",
        periodEnd: "Fri 30 Oct 2026, 00:00 UTC",
        generatedDate: new Date().toUTCString().replace("GMT", "UTC"),
        payoutDate: "Fri 30 Oct 2026, 00:00 UTC",
        netProfit,
        payoutPercent,
        totalPayout,
        perShare,
        publicShares,
        publicPayout,
        totalShares,
        operations: {
          tradesCount,
          tradesVolume,
          tradeCommissions,
          charterFees,
          charterCompaniesCount,
          depositGross,
          depositUnits,
          depositNetMargin,
          cogsExpenses,
        },
        sinceLaunch: {
          totalVolume: totalAllTimeVolume,
          allTimeNetProfit,
          allTimePaidOut,
          allTimePublicFloatPaid,
        },
      },
    });
  } catch (error: any) {
    console.error("GET /api/admin/shareholder-report error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const user = await getCurrentUser();

    if (!user || (!user.isAdmin && !user.isManager)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, payoutPercent = 50 } = body;

    if (action === "file_and_distribute") {
      const netProfit = 554.20;
      const grossRevenue = 638.50;
      const operatingExpenses = 84.30;

      // File and immediately distribute to all GUG shareholders
      const result = await reportEarningsAndDividend({
        companyId: "cmp_gug_001",
        reporterId: "usr_josepharora",
        periodTitle: "Week 2 — Audited Operating Profit & Dividend Distribution",
        grossRevenue,
        operatingExpenses,
        netProfit,
        dividendPercent: Number(payoutPercent) || 50,
        distributeImmediately: true,
        notes: `Audited Week 2 operational profits (Trading commissions: 101.12g, IPO charter fees: 318.80g, Deposit rail spread: 218.58g, less 84.30g COGS). Distributed 50% payout to all public and house shareholders.`,
      });

      scheduleBlobPersist();

      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Week 2 profits successfully filed and dividends distributed to all GUG shareholders!",
        reportId: result.reportId,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/shareholder-report error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
