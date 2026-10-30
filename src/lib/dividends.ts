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
  dividendPercent?: number;
  notes?: string;
  distributeImmediately?: boolean;
  scheduledFor?: string;
}): Promise<{ success: boolean; message: string; reportId?: string }> {
  await initDb();
  const db = getDb();

  const netProfit = Math.round(Number(params.netProfit) * 100) / 100;
  if (!Number.isFinite(netProfit) || netProfit <= 0) {
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
  const isCreator = String(company.creator_id) === String(user.id) || (company.co_founder_id && String(company.co_founder_id) === String(user.id));
  const isAdmin = Number(user.is_admin) === 1;

  if (!isCreator && !isAdmin) {
    return { success: false, message: "Only the enterprise founder or High Registrar operator can file official earnings." };
  }

  // Dividend pool (supports custom dividend percent or company default, e.g. 20% or 50%)
  const customPercent = params.dividendPercent !== undefined && Number.isFinite(Number(params.dividendPercent))
    ? Math.max(1, Math.min(100, Number(params.dividendPercent)))
    : Number(company.dividend_rate || 50.0);
  const dividendPool = Math.round(netProfit * (customPercent / 100) * 100) / 100;
  const eligibleShares = Number(company.total_shares);
  const dividendPerShare = Math.round((dividendPool / eligibleShares) * 10000) / 10000;

  // Determine scheduled Friday 00:00 UTC
  const nextFriday = getNextFridayUtc();
  const scheduledIso = params.scheduledFor || nextFriday.toISOString();
  const periodTitle = params.periodTitle || `Week ending ${nextFriday.toISOString().slice(0, 10)}`;

  // Prevent duplicate scheduled reports for the same period if distributeImmediately is not true
  if (!params.distributeImmediately) {
    const existingRes = await db.execute({
      sql: "SELECT id FROM earnings_reports WHERE company_id = ? AND scheduled_for = ? AND status = 'SCHEDULED'",
      args: [params.companyId, scheduledIso],
    });
    if (existingRes.rows.length > 0) {
      return {
        success: false,
        message: `An earnings report and dividend for period ending ${scheduledIso.slice(0, 10)} is already scheduled. Cancel the existing report first if you wish to amend it.`,
      };
    }
  }

  const reportId = `rep_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: `
      INSERT INTO earnings_reports (
        id, company_id, reporter_id, period_title, gross_revenue, operating_expenses,
        net_profit, dividend_percent, dividend_pool, eligible_shares, dividend_per_share,
        scheduled_for, status, notes, total_distributed, shareholders_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, 0.0, 0, ?)
    `,
    args: [
      reportId,
      params.companyId,
      params.reporterId,
      periodTitle,
      params.grossRevenue || netProfit,
      params.operatingExpenses || 0,
      netProfit,
      customPercent,
      dividendPool,
      eligibleShares,
      dividendPerShare,
      scheduledIso,
      params.notes || `${customPercent}% Net Profit Weekly Dividend Allocation`,
      now,
    ],
  });

  scheduleBlobPersist();

  // If immediate distribution requested or scheduled date is already passed
  if (params.distributeImmediately || new Date(scheduledIso) <= new Date()) {
    const distRes = await executeDividendPayout(reportId);
    if (!distRes.success) {
      return {
        success: false,
        message: `Earnings filed and scheduled for ${new Date(scheduledIso).toUTCString()}, but not paid now: ${distRes.message}`,
        reportId,
      };
    }
    return {
      success: true,
      message: `Earnings filed and ${customPercent}% dividend (${dividendPool.toLocaleString()} gold) distributed immediately to ${distRes.shareholdersPaid} shareholders!`,
      reportId,
    };
  }

  return {
    success: true,
    message: `Earnings filed! ${customPercent}% dividend pool (${dividendPool.toLocaleString()} gold, ${dividendPerShare.toFixed(4)}g/share) is scheduled for automatic distribution on Friday at 00:00 UTC.`,
    reportId,
  };
}

/**
 * Deposit operating profit / retained earnings directly into a company's corporate treasury
 */
export async function depositCompanyProfit(params: {
  companyId: string;
  amount: number;
  reporterId: string;
  notes?: string;
  source?: "WALLET" | "MANUAL_DIRECT";
}): Promise<{ success: boolean; message: string; newTreasuryBalance?: number }> {
  await initDb();
  const db = getDb();

  const amount = Math.round(Number(params.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: "Deposit amount must be a positive gold amount." };
  }

  const compRes = await db.execute({
    sql: "SELECT * FROM companies WHERE id = ?",
    args: [params.companyId],
  });
  if (compRes.rows.length === 0) {
    return { success: false, message: "Company not found." };
  }
  const company = compRes.rows[0];

  const userRes = await db.execute({
    sql: "SELECT * FROM users WHERE id = ?",
    args: [params.reporterId],
  });
  if (userRes.rows.length === 0) {
    return { success: false, message: "Reporter not found." };
  }
  const user = userRes.rows[0];
  const isCreator = String(company.creator_id) === String(user.id) || (company.co_founder_id && String(company.co_founder_id) === String(user.id));
  const isAdmin = Number(user.is_admin) === 1;

  if (!isCreator && !isAdmin) {
    return { success: false, message: "Only the enterprise founder or High Registrar operator can deposit corporate profits." };
  }

  const source = params.source || "WALLET";
  if (source === "WALLET") {
    const userCash = Number(user.cash_balance);
    if (userCash < amount) {
      return {
        success: false,
        message: `Insufficient personal balance (${userCash.toLocaleString()} gold available, needed ${amount.toLocaleString()} gold).`,
      };
    }

    const debit = await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ? AND cash_balance >= ?",
      args: [amount, user.id, amount],
    });
    if (debit.rowsAffected === 0) {
      return { success: false, message: "Failed to deduct funds from personal wallet." };
    }
  }

  // Credit company treasury and track lifetime profits deposited
  await db.execute({
    sql: `UPDATE companies 
          SET treasury_balance = treasury_balance + ?, 
              total_profit_deposited = total_profit_deposited + ? 
          WHERE id = ?`,
    args: [amount, amount, params.companyId],
  });

  const now = new Date().toISOString();
  // Record in company_ledger
  try {
    const ledgerId = `cld_${crypto.randomUUID()}`;
    await db.execute({
      sql: `INSERT INTO company_ledger (id, company_id, user_id, entry_type, category, amount, description, entry_date, created_at)
            VALUES (?, ?, ?, 'INCOME', 'OPERATING_PROFIT', ?, ?, ?, ?)`,
      args: [
        ledgerId,
        params.companyId,
        user.id,
        amount,
        params.notes || `Corporate Operating Profit Deposit (${source === "WALLET" ? "Personal Wallet" : "Direct Injection"})`,
        now.slice(0, 10),
        now,
      ],
    });
  } catch (e) {
    console.warn("Error logging company_ledger operating profit:", e);
  }

  scheduleBlobPersist();

  const updatedComp = await db.execute({
    sql: "SELECT treasury_balance FROM companies WHERE id = ?",
    args: [params.companyId],
  });
  const newBalance = Number(updatedComp.rows[0]?.treasury_balance || 0);

  return {
    success: true,
    message: `Successfully credited ${amount.toLocaleString()} gold of operating profit to $${company.ticker} Corporate Treasury. New Treasury Balance: ${newBalance.toLocaleString()} gold.`,
    newTreasuryBalance: newBalance,
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
  if (report.status !== "SCHEDULED") {
    return { success: false, message: "This earnings report was cancelled.", totalPaid: 0, shareholdersPaid: 0 };
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
      SELECT p.user_id, p.shares, u.username, u.display_name
      FROM portfolios p
      JOIN users u ON p.user_id = u.id
      WHERE p.company_id = ? AND p.shares > 0
    `,
    args: [companyId],
  });

  let totalPaid = 0;
  let shareholdersPaid = 0;
  const now = new Date().toISOString();

  // The dividend is paid out of the company corporate treasury, with founder purse as fallback
  const founderId = String(company.creator_id);
  const payoutOf = (row: Record<string, unknown>) => Math.round(Number(row.shares) * dividendPerShare * 100) / 100;
  const totalDue = Math.round(holdersRes.rows.reduce((sum, row) => sum + payoutOf(row), 0) * 100) / 100;
  // The founder's own shares are paid straight back into the founder's purse, so only the other holders' part
  // has to be there: the purse pays its share of the dividend net of the founder's own payout
  const founderRow = holdersRes.rows.find((row) => String(row.user_id) === founderId);
  const founderPayout = founderRow ? payoutOf(founderRow) : 0;
  const othersDue = Math.round((totalDue - founderPayout) * 100) / 100;

  // A treasury below zero (from older data) pays nothing; it never makes the founder cover the gap
  const treasuryBalance = Math.max(0, Number(company.treasury_balance || 0));
  const founderRes = await db.execute({ sql: "SELECT cash_balance FROM users WHERE id = ?", args: [founderId] });
  const founderCash = founderRes.rows.length > 0 ? Number(founderRes.rows[0].cash_balance) : 0;
  const totalAvailable = Math.round((treasuryBalance + founderCash) * 100) / 100;

  if (totalAvailable < othersDue) {
    return {
      success: false,
      message: `Other shareholders get ${othersDue.toLocaleString()} gold of this dividend, but the ${company.ticker} treasury and the founder's purse hold ${totalAvailable.toLocaleString()}. The founder's own ${founderPayout.toLocaleString()} needs no cover: it goes straight back.`,
      totalPaid: 0,
      shareholdersPaid: 0,
    };
  }

  // Claim the report first so concurrent calls can't pay it twice
  const claim = await db.execute({
    sql: "UPDATE earnings_reports SET status = 'DISTRIBUTED', distributed_at = ? WHERE id = ? AND status = 'SCHEDULED'",
    args: [now, reportId],
  });
  if (claim.rowsAffected === 0) {
    return { success: false, message: "Dividends for this period have already been distributed.", totalPaid: 0, shareholdersPaid: 0 };
  }

  // Deduct from corporate treasury first, remainder from founder purse if needed. The founder's payout is netted
  // against that remainder: the purse pays only what its own payout doesn't cover, or gains the difference.
  const fromTreasury = Math.min(treasuryBalance, totalDue);
  const fromFounder = Math.round((totalDue - fromTreasury) * 100) / 100;
  const founderNet = Math.round((founderPayout - fromFounder) * 100) / 100;
  const founderDebit = Math.max(0, -founderNet);

  if (fromTreasury > 0) {
    // Take the treasury's part only if it is still there: another payout may have spent it meanwhile
    const treasuryDebit = await db.execute({
      sql: "UPDATE companies SET treasury_balance = ROUND(treasury_balance - ?, 2) WHERE id = ? AND treasury_balance >= ?",
      args: [fromTreasury, companyId, fromTreasury],
    });
    if (treasuryDebit.rowsAffected === 0) {
      await db.execute({
        sql: "UPDATE earnings_reports SET status = 'SCHEDULED', distributed_at = NULL WHERE id = ?",
        args: [reportId],
      });
      return { success: false, message: "The treasury changed while this dividend was being paid. Try again.", totalPaid: 0, shareholdersPaid: 0 };
    }
  }
  if (founderDebit > 0) {
    const debit = await db.execute({
      sql: "UPDATE users SET cash_balance = cash_balance - ? WHERE id = ? AND cash_balance >= ?",
      args: [founderDebit, founderId, founderDebit],
    });
    if (debit.rowsAffected === 0) {
      // Revert claim and treasury deduction
      if (fromTreasury > 0) {
        await db.execute({
          sql: "UPDATE companies SET treasury_balance = treasury_balance + ? WHERE id = ?",
          args: [fromTreasury, companyId],
        });
      }
      await db.execute({
        sql: "UPDATE earnings_reports SET status = 'SCHEDULED', distributed_at = NULL WHERE id = ?",
        args: [reportId],
      });
      return { success: false, message: `The founder's purse no longer covers its part of the dividend (${founderDebit.toLocaleString()} gold).`, totalPaid: 0, shareholdersPaid: 0 };
    }
  }

  // Record the treasury's part of the dividend in company_ledger (the rest came from the founder's purse)
  try {
    if (fromTreasury > 0) {
      const ledgerId = `cld_${crypto.randomUUID()}`;
      await db.execute({
        sql: `INSERT INTO company_ledger (id, company_id, user_id, entry_type, category, amount, description, entry_date, created_at)
              VALUES (?, ?, ?, 'EXPENSE', 'DIVIDEND_DISTRIBUTION', ?, ?, ?, ?)`,
        args: [
          ledgerId,
          companyId,
          founderId,
          fromTreasury,
          `Dividend: ${report.period_title || "payout"} (${totalDue.toLocaleString()} gold in total` +
            (fromFounder > 0 ? `, ${fromFounder.toLocaleString()} from the founder's purse)` : ")"),
          now.slice(0, 10),
          now,
        ],
      });
    }
  } catch (e) {
    console.warn("Error logging company_ledger dividend distribution:", e);
  }

  for (const row of holdersRes.rows) {
    const userId = String(row.user_id);
    const shares = Number(row.shares);
    const payout = Math.round(shares * dividendPerShare * 100) / 100;
    // The founder's payout was netted against the purse's part above: the purse gets only what is left of it
    const credit = userId === founderId ? Math.max(0, founderNet) : payout;

    if (payout > 0) {
      // Credit gold to citizen or sovereign state wallet
      if (credit > 0) {
        await db.execute({
          sql: "UPDATE users SET cash_balance = cash_balance + ? WHERE id = ?",
          args: [credit, userId],
        });
      }

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
      `🪙 ${report.dividend_percent || 50}% PROFIT DIVIDEND: ${totalPaid.toLocaleString()} gold distributed!`,
      `Official Earnings & ${report.dividend_percent || 50}% Profit Dividend Distribution for period "${report.period_title}". Enterprise net profit: ${Number(report.net_profit).toLocaleString()} gold. A total of ${totalPaid.toLocaleString()} gold was allocated and deposited into the purses of ${shareholdersPaid} shareholder citizens (${dividendPerShare.toFixed(4)} gold per share).`,
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
