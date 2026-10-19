import { NextResponse } from "next/server";
import { getDb, initDb, LEAKED_API_KEY } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { 
  getSetting, 
  setSetting, 
  approveDeposit, 
  manualCreditCitizen 
} from "@/lib/wallet";

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access required." }, { status: 403 });
    }

    const [taxRate, houseName, apiKey, autoApprove, tradeFee, listingFee] = await Promise.all([
      getSetting("tax_rate", "10"),
      getSetting("house_name", "JosephArora"),
      getSetting("api_key", ""),
      getSetting("auto_approve_deposits", "true"),
      getSetting("trade_fee_percent", "0.5"),
      getSetting("ipo_listing_fee", "200"),
    ]);

    const { getMarketSchedule } = await import("@/lib/marketHours");
    const { getIPOApplications, getAllCompanies } = await import("@/lib/market");
    const [marketSchedule, ipoApplications, companies] = await Promise.all([
      getMarketSchedule(),
      getIPOApplications("PENDING"),
      getAllCompanies(),
    ]);

    // Fetch pending transactions
    const pendingRes = await db.execute(`
      SELECT w.*, u.username 
      FROM wallet_transactions w
      JOIN users u ON w.user_id = u.id
      WHERE w.status = 'PENDING'
      ORDER BY w.created_at DESC
    `);

    // Fetch citizens and sovereign states list with freeze and realm status
    const citizensRes = await db.execute(`
      SELECT id, username, display_name, parlamentum_name, cash_balance, locked_cash, is_admin, is_frozen, account_type, state_realm_name, state_motto, state_crest, created_at 
      FROM users 
      WHERE id NOT IN ('usr_treasury', 'usr_house')
      ORDER BY cash_balance DESC
    `);

    // Fetch user portfolios with company tickers and current prices
    const portfoliosRes = await db.execute(`
      SELECT p.user_id, p.company_id, p.shares, p.locked_shares, p.avg_buy_price,
             c.ticker, c.name as company_name, c.current_price
      FROM portfolios p
      JOIN companies c ON p.company_id = c.id
      WHERE (p.shares + p.locked_shares) > 0
    `);

    const userPortfoliosMap: { [userId: string]: { holdings: any[]; portfolioValue: number } } = {};
    for (const row of portfoliosRes.rows as any[]) {
      const uId = String(row.user_id);
      if (!userPortfoliosMap[uId]) {
        userPortfoliosMap[uId] = { holdings: [], portfolioValue: 0 };
      }
      const totalShares = Number(row.shares || 0) + Number(row.locked_shares || 0);
      const curPrice = Number(row.current_price || 0);
      const val = totalShares * curPrice;
      userPortfoliosMap[uId].portfolioValue += val;
      userPortfoliosMap[uId].holdings.push({
        companyId: row.company_id,
        ticker: row.ticker,
        companyName: row.company_name,
        shares: Number(row.shares || 0),
        lockedShares: Number(row.locked_shares || 0),
        totalShares,
        currentPrice: curPrice,
        holdingValue: val,
        avgBuyPrice: Number(row.avg_buy_price || 0),
      });
    }

    const enrichedCitizens = (citizensRes.rows as any[]).map((c) => {
      const uId = String(c.id);
      const port = userPortfoliosMap[uId] || { holdings: [], portfolioValue: 0 };
      const cash = Number(c.cash_balance || 0);
      const lockedCash = Number(c.locked_cash || 0);
      const portfolioValue = port.portfolioValue;
      const totalNetWorth = cash + lockedCash + portfolioValue;
      return {
        ...c,
        cash_balance: cash,
        locked_cash: lockedCash,
        portfolio_value: portfolioValue,
        total_net_worth: totalNetWorth,
        holdings: port.holdings,
      };
    });

    const { getEarningsReports, getNextFridayUtc, processScheduledDividends } = await import("@/lib/dividends");
    await processScheduledDividends().catch(() => {});
    const earningsReports = await getEarningsReports();
    const nextFriday = getNextFridayUtc();

    const { getLedgerEntries, getTradeInsights } = await import("@/lib/ledger");
    const ledgerEntries = await getLedgerEntries(60);
    const tradeInsights = await getTradeInsights();

    return NextResponse.json({
      success: true,
      settings: {
        taxRate: Number(taxRate),
        houseName,
        apiKey,
        autoApprove: autoApprove === "true",
        tradeFee: Number(tradeFee),
        listingFee: Number(listingFee),
      },
      marketSchedule,
      pendingDeposits: pendingRes.rows,
      ipoApplications,
      companies,
      citizens: enrichedCitizens,
      earningsReports,
      nextFriday: nextFriday.toISOString(),
      ledgerEntries,
      tradeInsights,
    });
  } catch (error: any) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Webhook/maintenance actions: the stored key must be set and must not be the old public default
async function isValidApiKey(apiKey: unknown): Promise<boolean> {
  const expectedKey = await getSetting("api_key", "");
  return typeof apiKey === "string" && expectedKey !== "" && expectedKey !== LEAKED_API_KEY && apiKey === expectedKey;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { action } = body;

    // 1. Direct In-Game Ledger Sync (/trade/ledger)
    if (action === "webhook_ledger_sync") {
      const { apiKey, entries, stats } = body;
      if (!(await isValidApiKey(apiKey))) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401, headers: corsHeaders });
      }

      const { syncLedgerData } = await import("@/lib/ledger");
      const res = await syncLedgerData(entries || [], stats);
      return NextResponse.json(res, { headers: corsHeaders });
    }

    // 2. Automated Parlamentum in-game sale event webhook
    if (action === "webhook_credit" || action === "webhook_sale_event") {
      const { apiKey, buyerName, goldAmount, ironUnits, rawNotification } = body;
      if (!(await isValidApiKey(apiKey))) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401, headers: corsHeaders });
      }

      const db = getDb();
      const units = Number(ironUnits) || (goldAmount ? Math.ceil(Number(goldAmount) / 5) : 0);
      const gold = Number(goldAmount) || (units * 5);

      // 1. If buyerName is specified, find their pending deposit for this amount or credit what was paid directly
      // (a pending deposit is only approved when the sale covers its amount, never on the claim alone)
      if (buyerName) {
        const pending = await db.execute({
          sql: `SELECT wt.id FROM wallet_transactions wt
                JOIN users u ON wt.user_id = u.id
                WHERE (LOWER(u.username) = ? OR LOWER(wt.parlamentum_name) = ?)
                AND wt.type = 'DEPOSIT' AND wt.status = 'PENDING' AND wt.amount = ?
                ORDER BY wt.created_at DESC LIMIT 1`,
          args: [buyerName.toLowerCase(), buyerName.toLowerCase(), gold],
        });

        if (pending.rows.length > 0) {
          const res = await approveDeposit(String(pending.rows[0].id));
          return NextResponse.json({ ...res, matchedPending: true }, { headers: corsHeaders });
        }

        const res = await manualCreditCitizen(
          buyerName,
          gold,
          `Automated Parlamentum sale webhook (${units} Raw Iron)`
        );
        return NextResponse.json(res, { headers: corsHeaders });
      }

      // 2. If buyerName is not in the notification (e.g. anonymous market sale: "2× Raw Iron sold — 10.00 gold"):
      // Automatically match the oldest PENDING deposit waiting for this exact Raw Iron quantity or gold!
      const pendingMatch = await db.execute({
        sql: `SELECT id, user_id, amount, iron_units, parlamentum_name 
              FROM wallet_transactions 
              WHERE type = 'DEPOSIT' AND status = 'PENDING' 
              AND (iron_units = ? OR amount = ?)
              ORDER BY created_at ASC LIMIT 1`,
        args: [units, gold],
      });

      if (pendingMatch.rows.length > 0) {
        const tx = pendingMatch.rows[0];
        const res = await approveDeposit(String(tx.id));
        return NextResponse.json({
          success: true,
          matched: true,
          message: `Auto-verified and approved deposit for ${tx.parlamentum_name} (${units} Raw Iron · ${gold} gold)!`,
          txId: tx.id,
        }, { headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        matched: false,
        message: `Sale event recorded (${units} Raw Iron · ${gold} gold), but no pending citizen deposit was waiting for this amount.`,
      }, { headers: corsHeaders });
    }

    if (action === "test_blob") {
      const { apiKey } = body;
      if (!(await isValidApiKey(apiKey))) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401, headers: corsHeaders });
      }
      const { persistDbToBlob, getDbPath, getDb, syncDbFromBlob } = await import("@/lib/db");
      const fs = await import("fs");
      const dbPath = getDbPath();
      const exists = fs.existsSync(dbPath);
      const walExists = fs.existsSync(dbPath + "-wal");
      const shmExists = fs.existsSync(dbPath + "-shm");
      const syncRes = await syncDbFromBlob(true);
      const db = getDb();
      const users = await db.execute("SELECT id, username FROM users");
      const persistResult = await persistDbToBlob();
      return NextResponse.json({
        success: true,
        tokenExists: !!process.env.BLOB_READ_WRITE_TOKEN,
        tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 15) : null,
        isVercel: !!process.env.VERCEL,
        dbPath,
        exists,
        walExists,
        shmExists,
        users: users.rows,
        persistResult,
      }, { headers: corsHeaders });
    }

    // Direct Purge & Admin Setup (secured by API key)
    if (action === "purge_users_and_create_admin") {
      const { apiKey } = body;
      if (!(await isValidApiKey(apiKey))) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401, headers: corsHeaders });
      }

      const db = getDb();
      const now = new Date().toISOString();
      const passHash = "$2b$10$xRYixtfhwn2eJesmqVhZFOUGQVZLjjqza9XfR7A4EcwCHgjL53EWe";

      // 1. Create or update JosephArora
      await db.execute({
        sql: `INSERT OR REPLACE INTO users (id, username, password_hash, display_name, parlamentum_name, cash_balance, locked_cash, avatar, is_admin, created_at)
              VALUES ('usr_josepharora', 'JosephArora', ?, 'Joseph Arora', 'JosephArora', 0.0, 0.0, '🏛️', 1, ?)`,
        args: [passHash, now]
      });

      // 2. Ensure CardinalSanjay exists with exact 5 gold and 5 shares
      const sanjayRes = await db.execute("SELECT id FROM users WHERE LOWER(username) = 'cardinalsanjay'");
      const sanjayId = sanjayRes.rows.length > 0 ? String(sanjayRes.rows[0].id) : 'usr_2eb75326';
      await db.execute({
        sql: `UPDATE users SET cash_balance = 5.0, locked_cash = 0.0, password_hash = ? WHERE id = ?`,
        args: [passHash, sanjayId]
      });

      // 3. Reassign companies, announcements, orders to usr_josepharora
      await db.execute(`UPDATE companies SET creator_id = 'usr_josepharora';`);
      await db.execute(`UPDATE announcements SET author_id = 'usr_josepharora';`);
      await db.execute(`UPDATE orders SET user_id = 'usr_josepharora' WHERE user_id IN ('usr_house', 'usr_treasury');`);

      // 4. Recreate portfolios
      await db.execute(`DELETE FROM portfolios WHERE user_id IN ('usr_house', 'usr_treasury');`);
      await db.execute({
        sql: `INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
              VALUES ('port_cardinalsanjay_GUG', ?, 'cmp_gug_001', 5, 0, 3.0)`,
        args: [sanjayId]
      });
      await db.execute(`
        INSERT OR REPLACE INTO portfolios (id, user_id, company_id, shares, locked_shares, avg_buy_price)
        VALUES ('port_usr_josepharora_GUG', 'usr_josepharora', 'cmp_gug_001', 9995, 1000, 3.0);
      `);

      // 4. Delete all other users and their data except CardinalSanjay and JosephArora
      await db.execute(`
        DELETE FROM wallet_transactions WHERE user_id NOT IN (
          SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
        );
      `);
      await db.execute(`
        DELETE FROM orders WHERE user_id NOT IN (
          SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
        );
      `);
      await db.execute(`
        DELETE FROM portfolios WHERE user_id NOT IN (
          SELECT id FROM users WHERE LOWER(username) IN ('cardinalsanjay', 'josepharora')
        );
      `);
      await db.execute(`
        DELETE FROM users WHERE LOWER(username) NOT IN ('cardinalsanjay', 'josepharora');
      `);

      const remainingUsers = await db.execute(`SELECT id, username, display_name, is_admin, cash_balance FROM users;`);

      return NextResponse.json({
        success: true,
        message: "All users purged except CardinalSanjay, and admin JosephArora created successfully!",
        users: remainingUsers.rows,
      }, { headers: corsHeaders });
    }

    // Otherwise require logged-in admin
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access required." }, { status: 403 });
    }

    if (action === "credit_ledger_entry_manual") {
      const { entryId, username } = body;
      const db = getDb();
      const entryRes = await db.execute({
        sql: "SELECT * FROM parlamentum_ledger_entries WHERE id = ?",
        args: [entryId],
      });
      if (entryRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Ledger transaction entry not found" }, { status: 404 });
      }
      const entry = entryRes.rows[0];
      const targetUser = username || entry.with_user;
      if (!targetUser) {
        return NextResponse.json({ success: false, message: "No citizen username specified for credit." }, { status: 400 });
      }
      // Claim the entry before crediting so it can only ever be paid out once
      const claim = await db.execute({
        sql: `UPDATE parlamentum_ledger_entries SET status = 'AUTO_CREDITED', with_user = ?
              WHERE id = ? AND status NOT IN ('AUTO_CREDITED', 'MATCHED_PENDING')`,
        args: [String(targetUser), entryId],
      });
      if (claim.rowsAffected === 0) {
        return NextResponse.json({ success: false, message: "This ledger entry has already been credited." }, { status: 409 });
      }
      const { manualCreditCitizen } = await import("@/lib/wallet");
      const res = await manualCreditCitizen(
        String(targetUser),
        Number(entry.total_amount),
        `Manual Ledger Credit for ${entry.quantity}x ${entry.item_name} (Fill: ${entry.trade_date})`
      );
      if (res.success) {
        const { scheduleBlobPersist } = await import("@/lib/db");
        scheduleBlobPersist();
      } else {
        await db.execute({
          sql: "UPDATE parlamentum_ledger_entries SET status = ?, with_user = ? WHERE id = ?",
          args: [entry.status, entry.with_user, entryId],
        });
      }
      return NextResponse.json(res);
    }

    if (action === "approve") {
      const { txId } = body;
      const res = await approveDeposit(txId);
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "reject") {
      const { txId } = body;
      const { rejectTransaction } = await import("@/lib/wallet");
      const res = await rejectTransaction(txId);
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "manual_credit") {
      const { parlamentumName, goldAmount, reason } = body;
      const res = await manualCreditCitizen(parlamentumName, Number(goldAmount), reason);
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "adjust_user_balance") {
      const { userId, newBalance, reason } = body;
      const db = getDb();
      const targetBalance = Number(newBalance);
      if (isNaN(targetBalance) || targetBalance < 0) {
        return NextResponse.json({ success: false, message: "Invalid gold balance value." }, { status: 400 });
      }

      const userRes = await db.execute({
        sql: "SELECT id, username, cash_balance FROM users WHERE id = ?",
        args: [userId],
      });
      if (userRes.rows.length === 0) {
        return NextResponse.json({ success: false, message: "Citizen not found." }, { status: 404 });
      }
      const targetUser = userRes.rows[0];
      const oldBalance = Number(targetUser.cash_balance);
      const diff = targetBalance - oldBalance;

      await db.execute({
        sql: "UPDATE users SET cash_balance = ? WHERE id = ?",
        args: [targetBalance, userId],
      });

      const now = new Date().toISOString();
      const txId = `tx_adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.execute({
        sql: `INSERT INTO wallet_transactions (id, user_id, type, method, amount, parlamentum_name, status, recipe_note, created_at)
              VALUES (?, ?, ?, 'OPERATOR_ADJUSTMENT', ?, ?, 'COMPLETED', ?, ?)`,
        args: [
          txId,
          userId,
          diff >= 0 ? "DEPOSIT" : "WITHDRAWAL",
          Math.abs(diff),
          String(targetUser.username),
          reason || `Operator balance adjustment (${oldBalance}g -> ${targetBalance}g)`,
          now,
        ],
      });

      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();

      return NextResponse.json({
        success: true,
        message: `Updated @${targetUser.username}'s purse from ${oldBalance}g to ${targetBalance}g!`,
        oldBalance,
        newBalance: targetBalance,
      });
    }

    if (action === "update_settings") {
      const { taxRate, houseName, autoApprove, apiKey, tradeFee, listingFee } = body;
      if (taxRate !== undefined) await setSetting("tax_rate", String(taxRate));
      if (houseName !== undefined) await setSetting("house_name", String(houseName));
      if (autoApprove !== undefined) await setSetting("auto_approve_deposits", String(autoApprove));
      if (apiKey !== undefined) await setSetting("api_key", String(apiKey));
      if (tradeFee !== undefined) await setSetting("trade_fee_percent", String(tradeFee));
      if (listingFee !== undefined) await setSetting("ipo_listing_fee", String(listingFee));

      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();

      return NextResponse.json({ success: true, message: "Operator settings updated successfully!" });
    }

    if (action === "freeze_user") {
      const { userId } = body;
      const db = getDb();
      await db.execute({
        sql: "UPDATE users SET is_frozen = 1 WHERE id = ?",
        args: [userId],
      });
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json({ success: true, message: "Citizen wallet FROZEN. All trading & withdrawal halted." });
    }

    if (action === "unfreeze_user") {
      const { userId } = body;
      const db = getDb();
      await db.execute({
        sql: "UPDATE users SET is_frozen = 0 WHERE id = ?",
        args: [userId],
      });
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json({ success: true, message: "Citizen wallet UNFROZEN. Trading restored." });
    }

    if (action === "set_company_status") {
      const { companyId, status } = body;
      if (!["ACTIVE", "HALTED", "DEFAULTED"].includes(status)) {
        return NextResponse.json({ success: false, message: "Invalid status" }, { status: 400 });
      }
      const db = getDb();
      await db.execute({
        sql: "UPDATE companies SET status = ? WHERE id = ?",
        args: [status, companyId],
      });
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json({ success: true, message: `Company status updated to ${status}.` });
    }

    if (action === "approve_ipo") {
      const { appId, negotiatedPrice, negotiatedShares, negotiatedFounderRetainPercent, negotiatedFloatPercent, operatorNotes } = body;
      const { approveAndListIPO } = await import("@/lib/market");

      let retainPercent: number | undefined = undefined;
      if (negotiatedFounderRetainPercent !== undefined && !isNaN(Number(negotiatedFounderRetainPercent))) {
        retainPercent = Number(negotiatedFounderRetainPercent);
      } else if (negotiatedFloatPercent !== undefined && !isNaN(Number(negotiatedFloatPercent))) {
        retainPercent = 100 - Number(negotiatedFloatPercent);
      }

      const res = await approveAndListIPO(
        appId, 
        negotiatedPrice !== undefined ? Number(negotiatedPrice) : undefined, 
        negotiatedShares !== undefined ? Number(negotiatedShares) : undefined, 
        retainPercent,
        operatorNotes
      );
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "reject_ipo") {
      const { appId, reason } = body;
      const { rejectIPOApplication } = await import("@/lib/market");
      const res = await rejectIPOApplication(appId, reason);
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "update_schedule") {
      const { openTime, closeTime, override } = body;
      if (openTime !== undefined) await setSetting("market_open_time", String(openTime));
      if (closeTime !== undefined) await setSetting("market_close_time", String(closeTime));
      if (override !== undefined) await setSetting("market_override", String(override));

      const { getMarketSchedule } = await import("@/lib/marketHours");
      const updatedSchedule = await getMarketSchedule();
      return NextResponse.json({ success: true, message: "Market schedule updated successfully!", schedule: updatedSchedule });
    }


    if (action === "report_earnings") {
      const { companyId, grossRevenue, operatingExpenses, netProfit, periodTitle, notes, distributeImmediately, scheduledFor } = body;
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

      const { reportEarningsAndDividend } = await import("@/lib/dividends");
      const res = await reportEarningsAndDividend({
        companyId,
        reporterId: user.id,
        grossRevenue: grossRevenue ? parseFloat(grossRevenue) : undefined,
        operatingExpenses: operatingExpenses ? parseFloat(operatingExpenses) : undefined,
        netProfit: parseFloat(netProfit),
        periodTitle,
        notes,
        distributeImmediately: Boolean(distributeImmediately),
        scheduledFor,
      });
      return NextResponse.json(res);
    }

    if (action === "distribute_dividend_now") {
      const { reportId } = body;
      const { executeDividendPayout } = await import("@/lib/dividends");
      const res = await executeDividendPayout(reportId);
      return NextResponse.json(res);
    }

    if (action === "process_scheduled_dividends") {
      const { processScheduledDividends } = await import("@/lib/dividends");
      const res = await processScheduledDividends();
      return NextResponse.json({ success: true, message: `Processed ${res.executedCount} scheduled Friday dividend distributions.`, ...res });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
