import { getDb, initDb, scheduleBlobPersist } from "./db";
import crypto from "crypto";

export interface EarningsReport {
  id: string;
  companyId: string;
  companyTicker?: string;
  companyName?: string;
  reporterId: string;
  reporterName?: string;
  periodTitle: string;
  grossRevenue: number;
  operatingExpenses: number;
  netProfit: number;
  dividendPercent: number; // 50%
  dividendPool: number;
  eligibleShares: number;
  dividendPerShare: number;
  scheduledFor: string;
  status: "SCHEDULED" | "DISTRIBUTED" | "CANCELLED";
  notes?: string;
  distributedAt?: string;
  totalDistributed: number;
  shareholdersCount: number;
  createdAt: string;
}

export interface DividendPayoutItem {
  id: string;
  reportId: string;
  companyId: string;
  ticker?: string;
  companyName?: string;
  userId: string;
  username?: string;
  displayName?: string;
  accountType?: string;
  stateRealmName?: string;
  sharesCount: number;
  dividendPerShare: number;
  payoutAmount: number;
  createdAt: string;
}

/**
 * Returns the upcoming Friday at 00:00:00.000 UTC
 */
export function getNextFridayUtc(): Date {
  const now = new Date();
  const result = new Date(now.getTime());
  
  // Day of week: 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const day = result.getUTCDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  
  // If today is Friday but already past 00:00 UTC, advance to next Friday
  if (daysUntilFriday === 0 && (now.getUTCHours() > 0 || now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0)) {
    daysUntilFriday = 7;
  }
  
  result.setUTCDate(result.getUTCDate() + daysUntilFriday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Fetch earnings reports for a company or exchange-wide
 */
export async function getEarningsReports(companyId?: string): Promise<EarningsReport[]> {
  await initDb();
  const db = getDb();

  let query = `
    SELECT e.*, c.ticker as company_ticker, c.name as company_name, u.display_name as reporter_name
    FROM earnings_reports e
    JOIN companies c ON e.company_id = c.id
    JOIN users u ON e.reporter_id = u.id
  `;
  const args: any[] = [];

  if (companyId) {
    query += " WHERE e.company_id = ?";
    args.push(companyId);
  }

  query += " ORDER BY e.created_at DESC";

  const res = await db.execute({ sql: query, args });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    companyTicker: r.company_ticker ? String(r.company_ticker) : undefined,
    companyName: r.company_name ? String(r.company_name) : undefined,
    reporterId: String(r.reporter_id),
    reporterName: r.reporter_name ? String(r.reporter_name) : undefined,
    periodTitle: String(r.period_title),
    grossRevenue: Number(r.gross_revenue || 0),
    operatingExpenses: Number(r.operating_expenses || 0),
    netProfit: Number(r.net_profit),
    dividendPercent: Number(r.dividend_percent || 50),
    dividendPool: Number(r.dividend_pool),
    eligibleShares: Number(r.eligible_shares),
    dividendPerShare: Number(r.dividend_per_share),
    scheduledFor: String(r.scheduled_for),
    status: r.status as any,
    notes: r.notes ? String(r.notes) : undefined,
    distributedAt: r.distributed_at ? String(r.distributed_at) : undefined,
    totalDistributed: Number(r.total_distributed || 0),
    shareholdersCount: Number(r.shareholders_count || 0),
    createdAt: String(r.created_at),
  }));
}

/**
 * Fetch dividend payouts received by a specific user or state
 */
export async function getUserDividendHistory(userId: string): Promise<DividendPayoutItem[]> {
  await initDb();
  const db = getDb();

  const res = await db.execute({
    sql: `
      SELECT dp.*, c.ticker, c.name as company_name
      FROM dividend_payouts dp
      JOIN companies c ON dp.company_id = c.id
      WHERE dp.user_id = ?
      ORDER BY dp.created_at DESC
      LIMIT 100
    `,
    args: [userId],
  });

  return res.rows.map((r: any) => ({
    id: String(r.id),
    reportId: String(r.report_id),
    companyId: String(r.company_id),
    ticker: String(r.ticker),
    companyName: String(r.company_name),
    userId: String(r.user_id),
    sharesCount: Number(r.shares_count),
    dividendPerShare: Number(r.dividend_per_share),
    payoutAmount: Number(r.payout_amount),
    createdAt: String(r.created_at),
  }));
}

/**
 * Report corporate earnings and declare a 50% profit dividend
 */
export async function reportEarningsAndDividend(params: {
  companyId: string;
  reporterId: string;
  periodTitle?: string;
  grossRevenue?: number;
  operatingExpenses?: number;
  netProfit: number;
  notes?: string;
  distributeImmediately?: boolean;
  scheduledFor?: string;
}): Promise<{ success: boolean; message: string; reportId?: string }> {
  await initDb();
  const db = getDb();

  const netProfit = Math.round(Number(params.netProfit) * 100) / 100;
  if (isNaN(netProfit) || netProfit <= 0) {
    return { success: false, message: "Net profit must be a positive gold amount." };
  }

  // Check company
  const compRes = await db.execute({
    sql: "SELECT * FROM companies WHERE id = ?",
    args: [params.companyId],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found." };
  }
  const company = compRes.rows[0];

  // Verify reporter authorization (creator or admin)
  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [params.reporterId],
  });
  if (userRes.rows.length === 0) {
    return { success: false, message: "Reporter not found." };
  }
  const user = userRes.rows[0];
  const isCreator = String(company.creator_id) === String(user.id);
  const isAdmin = Number(user.is_admin) === 1;

  if (!isCreator && !isAdmin) {
    return { success: false, message: "Only the enterprise founder or High Registrar operator can file official earnings." };
  }

  // 50% profit dividend pool
  const dividendPool = Math.round(netProfit * 0.50 * 100) / 100;
  const eligibleShares = Number(company.total_shares);
  const dividendPerShare = Math.round((dividendPool / eligibleShares) * 10000) / 10000;

  // Determine scheduled Friday 00:00 UTC
  const nextFriday = getNextFridayUtc();
  const scheduledIso = params.scheduledFor || nextFriday.toISOString();
  const periodTitle = params.periodTitle || `Week ending ${nextFriday.toISOString().slice(0, 10)}`;

  const reportId = `rep_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO earnings_reports (
        id, company_id, reporter_id, period_title, gross_revenue, operating_expenses,
        net_profit, dividend_percent, dividend_pool, eligible_shares, dividend_per_share,
        scheduled_for, status, notes, total_distributed, shareholders_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 50.0, ?, ?, ?, ?, 'SCHEDULED', ?, 0.0, 0, ?)
    `,
    args: [
      reportId,
      params.companyId,
      params.reporterId,
      periodTitle,
      params.grossRevenue || netProfit,
      params.operatingExpenses || 0,
      netProfit,
      dividendPool,
      eligibleShares,
      dividendPerShare,
      scheduledIso,
      params.notes || "50% Net Profit Weekly Dividend Allocation",
      now,
    ],
  });

  scheduleBlobPersist();

  // If immediate distribution requested or scheduled date is already passed
  if (params.distributeImmediately || new Date(scheduledIso) <= new Date()) {
    const distRes = await executeDividendPayout(reportId);
    return {
      success: true,
      message: `Earnings filed and 50% dividend (${dividendPool.toLocaleString()} gold) distributed immediately to ${distRes.shareholdersPaid} shareholders!`,
      reportId,
    };
  }

  return {
    success: true,
    message: `Earnings filed! 50% dividend pool (${dividendPool.toLocaleString()} gold, ${dividendPerShare.toFixed(4)}g/share) is scheduled for automatic distribution on Friday at 00:00 UTC.`,
    reportId,
  };
}

/**
 * Execute dividend payout to all shareholders holding shares in the company
 */
export async function executeDividendPayout(reportId: string): Promise<{
  success: boolean;
  message: string;
  totalPaid: number;
  shareholdersPaid: number;
}> {
  await initDb();
  const db = getDb();

  const repRes = await db.execute({
    sql: "SELECT * FROM earnings_reports WHERE id = ?",
    args: [reportId],
  });

  if (repRes.rows.length === 0) {
    return { success: false, message: "Earnings report not found.", totalPaid: 0, shareholdersPaid: 0 };
  }

  const report = repRes.rows[0];
  if (report.status === "DISTRIBUTED") {
    return { success: false, message: "Dividends for this period have already been distributed.", totalPaid: 0, shareholdersPaid: 0 };
  }

  const companyId = String(report.company_id);
  const compRes = await db.execute({
    sql: "SELECT * FROM companies WHERE id = ?",
    args: [companyId],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found.", totalPaid: 0, shareholdersPaid: 0 };
  }
  const company = compRes.rows[0];

  const dividendPerShare = Number(report.dividend_per_share);

  // Find all shareholders holding at least 1 share
  const holdersRes = await db.execute({
    sql: `
      SELECT p.user_id, p.shares, u.username, u.display_name, u.account_type, u.state_realm_name
      FROM portfolios p
      JOIN users u ON p.user_id = u.id
      WHERE p.company_id = ? AND p.shares > 0
    `,
    args: [companyId],
  });

  let totalPaid = 0;
  let shareholdersPaid = 0;
  const now = new Date().toISOString();

  for (const row of holdersRes.rows) {
    const userId = String(row.user_id);
    const shares = Number(row.shares);
    const payout = Math.round(shares * dividendPerShare * 100) / 100;

    if (payout > 0) {
      // Credit gold to citizen or sovereign state wallet
      await db.execute({
        sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
        args: [payout, userId],
      });

      // Record payout item
      const payoutId = `payout_${crypto.randomUUID().slice(0, 8)}`;
      await db.execute({
        sql: `
          INSERT INTO dividend_payouts (id, report_id, company_id, user_id, shares_count, dividend_per_share, payout_amount, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [payoutId, reportId, companyId, userId, shares, dividendPerShare, payout, now],
      });

      totalPaid += payout;
      shareholdersPaid += 1;
    }
  }

  totalPaid = Math.round(totalPaid * 100) / 100;

  // Update report
  await db.execute({
    sql: `
      UPDATE earnings_reports 
      SET status = 'DISTRIBUTED', distributed_at = ?, total_distributed = ?, shareholders_count = ?
      WHERE id = ?
    `,
    args: [now, totalPaid, shareholdersPaid, reportId],
  });

  // Update company metrics
  await db.execute({
    sql: `
      UPDATE companies
      SET total_dividends_paid = total_dividends_paid + ?, last_dividend_date = ?
      WHERE id = ?
    `,
    args: [totalPaid, now, companyId],
  });

  // Publish official corporate announcement on the bourse
  const annId = `ann_div_${reportId}`;
  await db.execute({
    sql: `
      INSERT INTO announcements (id, company_id, title, content, author_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      annId,
      companyId,
      `🪙 50% PROFIT DIVIDEND: ${totalPaid.toLocaleString()} gold distributed!`,
      `Official Earnings & 50% Profit Dividend Distribution for period "${report.period_title}". Enterprise net profit: ${Number(report.net_profit).toLocaleString()} gold. A total of ${totalPaid.toLocaleString()} gold was allocated and deposited into the purses of ${shareholdersPaid} shareholder citizens & sovereign state treasuries (${dividendPerShare.toFixed(4)} gold per share).`,
      String(report.reporter_id),
      now,
    ],
  });

  scheduleBlobPersist();

  return {
    success: true,
    message: `Distributed ${totalPaid.toLocaleString()} gold to ${shareholdersPaid} shareholders!`,
    totalPaid,
    shareholdersPaid,
  };
}

/**
 * Scans for any scheduled earnings reports whose Friday 00:00 UTC date has arrived and executes them
 */
export async function processScheduledDividends(): Promise<{ executedCount: number }> {
  await initDb();
  const db = getDb();

  const nowIso = new Date().toISOString();
  const res = await db.execute({
    sql: "SELECT id FROM earnings_reports WHERE status = 'SCHEDULED' AND scheduled_for <= ?",
    args: [nowIso],
  });

  let executedCount = 0;
  for (const row of res.rows) {
    try {
      await executeDividendPayout(String(row.id));
      executedCount++;
    } catch (e) {
      console.error(`Failed to execute scheduled dividend ${row.id}:`, e);
    }
  }

  return { executedCount };
}
