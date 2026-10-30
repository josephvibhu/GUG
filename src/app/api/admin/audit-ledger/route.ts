import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/wallet";

export async function GET(request: Request) {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    if (!user || (!user.isAdmin && !user.isManager)) {
      return NextResponse.json({ success: false, message: "Unauthorized: Operator or Manager role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get("since");

    // Fetch the stored timestamp of the last generated snapshot
    const lastCutoffSetting = await getSetting("last_audit_pdf_timestamp", "2026-01-01T00:00:00.000Z");
    const cutoffDate = sinceParam ? sinceParam : lastCutoffSetting;
    const nowIso = new Date().toISOString();

    // 1. Fetch House and Treasury metrics
    const [houseUserRes, treasuryRes, companiesRes] = await Promise.all([
      db.execute("SELECT id, username, parlamentum_name, cash_balance, locked_cash FROM users WHERE id = 'usr_josepharora' OR username = 'JosephArora'"),
      db.execute("SELECT cash_balance, locked_cash FROM users WHERE id = 'usr_treasury'"),
      db.execute(`
        SELECT c.id, c.ticker, c.name, c.creator_id, c.status, c.total_shares, c.float_shares,
               c.current_price, c.dividend_rate, c.total_dividends_paid, c.last_dividend_date,
               c.treasury_balance, c.weekly_revenue, c.ipo_fee_collected,
               u.username as creator_name, u.parlamentum_name as creator_parlamentum
        FROM companies c
        LEFT JOIN users u ON c.creator_id = u.id
        ORDER BY c.ticker ASC
      `),
    ]);

    const houseUser = houseUserRes.rows[0] || { username: "JosephArora", cash_balance: 0, locked_cash: 0 };
    const treasuryUser = treasuryRes.rows[0] || { cash_balance: 0, locked_cash: 0 };
    const companies = companiesRes.rows;

    // 2. Fetch all wallet transactions since cutoff (and all time summary)
    const [txDeltaRes, txAllTimeRes] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM wallet_transactions WHERE created_at >= ? ORDER BY created_at DESC`,
        args: [cutoffDate],
      }),
      db.execute(`
        SELECT type, status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
        FROM wallet_transactions
        GROUP BY type, status
      `),
    ]);

    // 3. Fetch all trades since cutoff (and all time volume)
    const [tradesDeltaRes, tradesAllTimeRes] = await Promise.all([
      db.execute({
        sql: `
          SELECT t.id, t.company_id, c.ticker, c.name as company_name,
                 t.price, t.quantity, t.total, t.created_at,
                 b.username as buyer_name, s.username as seller_name
          FROM trades t
          JOIN companies c ON t.company_id = c.id
          JOIN users b ON t.buyer_id = b.id
          JOIN users s ON t.seller_id = s.id
          WHERE t.created_at >= ?
          ORDER BY t.created_at DESC
        `,
        args: [cutoffDate],
      }),
      db.execute(`
        SELECT t.company_id, c.ticker, COUNT(*) as trade_count,
               COALESCE(SUM(t.quantity), 0) as total_shares_traded,
               COALESCE(SUM(t.total), 0) as total_volume_gold
        FROM trades t
        JOIN companies c ON t.company_id = c.id
        GROUP BY t.company_id, c.ticker
      `),
    ]);

    // 4. Fetch all earnings reports and dividends since cutoff
    const earningsReportsRes = await db.execute({
      sql: `
        SELECT r.*, c.ticker, c.name as company_name, u.username as reporter_name
        FROM earnings_reports r
        JOIN companies c ON r.company_id = c.id
        JOIN users u ON r.reporter_id = u.id
        WHERE r.created_at >= ? OR r.distributed_at >= ?
        ORDER BY r.created_at DESC
      `,
      args: [cutoffDate, cutoffDate],
    });

    // 5. Fetch all shareholders grouped by stock
    const shareholdersRes = await db.execute(`
      SELECT p.company_id, c.ticker, c.name as company_name,
             p.user_id, u.username, u.parlamentum_name,
             p.shares, p.locked_shares,
             (c.creator_id = p.user_id) as is_founder,
             (u.id = 'usr_josepharora' OR u.username = 'JosephArora') as is_house
      FROM portfolios p
      JOIN companies c ON p.company_id = c.id
      JOIN users u ON p.user_id = u.id
      WHERE p.shares > 0 OR p.locked_shares > 0
      ORDER BY c.ticker ASC, p.shares DESC
    `);

    // 6. Aggregate citizen cash liabilities
    const citizenLiabilitiesRes = await db.execute(`
      SELECT
        COUNT(*) as total_citizens,
        COALESCE(SUM(CASE WHEN id NOT IN ('usr_josepharora', 'usr_treasury') THEN cash_balance ELSE 0 END), 0) as citizen_liquid_cash,
        COALESCE(SUM(CASE WHEN id NOT IN ('usr_josepharora', 'usr_treasury') THEN locked_cash ELSE 0 END), 0) as citizen_locked_cash
      FROM users
    `);
    const citizenLiabilities = citizenLiabilitiesRes.rows[0];

    // 7. Calculate in-game reserve requirements:
    // In-Game Gold the House character must hold =
    // (Total Citizen Liquid Cash + Total Citizen Locked Cash + Total Company Treasuries)
    // minus any gold already held in the web platform treasury
    const totalCompanyTreasuries = companies.reduce((sum: number, c: any) => sum + Number(c.treasury_balance || 0), 0);
    const totalCitizenGoldLiabilities = Number(citizenLiabilities.citizen_liquid_cash || 0) + Number(citizenLiabilities.citizen_locked_cash || 0);

    // Pending in-game withdrawal tickets that operator still needs to fulfill in Parlamentum
    const pendingWithdrawalsRes = await db.execute(`
      SELECT id, user_id, amount, parlamentum_name, created_at, recipe_note
      FROM wallet_transactions
      WHERE type = 'WITHDRAWAL' AND status = 'PENDING'
      ORDER BY created_at ASC
    `);

    const pendingWithdrawalsGold = pendingWithdrawalsRes.rows.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    // Minimum in-game cash required on JosephArora character:
    // Citizens expect their gold to be backed 1:1 if all withdraw or if pending are paid
    const requiredInGameReserves = {
      pendingWithdrawalsOwed: Math.round(pendingWithdrawalsGold * 100) / 100,
      totalCitizenLiabilities: Math.round(totalCitizenGoldLiabilities * 100) / 100,
      totalCompanyTreasuries: Math.round(totalCompanyTreasuries * 100) / 100,
      totalCustomerBackingRequired: Math.round((totalCitizenGoldLiabilities + totalCompanyTreasuries) * 100) / 100,
      houseSpendablePurse: Number(houseUser.cash_balance || 0),
      platformFeeProfit: Number(treasuryUser.cash_balance || 0),
      totalHouseEquity: Math.round((Number(houseUser.cash_balance || 0) + Number(treasuryUser.cash_balance || 0)) * 100) / 100,
    };

    return NextResponse.json({
      success: true,
      period: {
        from: cutoffDate,
        to: nowIso,
        isFirstRun: cutoffDate === "2026-01-01T00:00:00.000Z",
      },
      houseUser,
      treasuryUser,
      requiredInGameReserves,
      companies,
      transactions: txDeltaRes.rows,
      allTimeTxSummary: txAllTimeRes.rows,
      trades: tradesDeltaRes.rows,
      tradesAllTime: tradesAllTimeRes.rows,
      earningsReports: earningsReportsRes.rows,
      shareholders: shareholdersRes.rows,
      pendingWithdrawals: pendingWithdrawalsRes.rows,
    });
  } catch (error: any) {
    console.error("GET /api/admin/audit-ledger error:", error);
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

    const body = await request.json();
    const { action, timestamp } = body;

    if (action === "set_cutoff") {
      const targetTime = timestamp || new Date().toISOString();
      await setSetting("last_audit_pdf_timestamp", targetTime);
      return NextResponse.json({
        success: true,
        message: "Audit ledger bookmark updated successfully.",
        newCutoff: targetTime,
      });
    }

    if (action === "reset_cutoff") {
      await setSetting("last_audit_pdf_timestamp", "2026-01-01T00:00:00.000Z");
      return NextResponse.json({
        success: true,
        message: "Audit ledger bookmark reset to genesis (all time).",
        newCutoff: "2026-01-01T00:00:00.000Z",
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin/audit-ledger error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
