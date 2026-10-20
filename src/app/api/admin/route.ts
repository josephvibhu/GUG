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

    const [
      taxRate,
      houseName,
      apiKey,
      autoApprove,
      tradeFee,
      listingFee,
      discordWebhookUrl,
      discordWhaleThreshold,
      discordAlertsEnabled,
      parlamentumCookie,
      lastCloudSyncAt,
      lastCloudSyncStatus,
      lastCloudSyncMessage,
      lastCloudSyncFills,
    ] = await Promise.all([
      getSetting("tax_rate", "10"),
      getSetting("house_name", "JosephArora"),
      getSetting("api_key", ""),
      getSetting("auto_approve_deposits", "true"),
      getSetting("trade_fee_percent", "0.5"),
      getSetting("ipo_listing_fee", "200"),
      getSetting("discord_webhook_url", ""),
      getSetting("discord_whale_threshold", "25"),
      getSetting("discord_alerts_enabled", "true"),
      getSetting("parlamentum_cookie", ""),
      getSetting("last_cloud_sync_at", ""),
      getSetting("last_cloud_sync_status", "IDLE"),
      getSetting("last_cloud_sync_message", ""),
      getSetting("last_cloud_sync_fills", "0"),
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
             c.ticker, c.name as company_name, c.current_price, c.creator_id
      FROM portfolios p
      JOIN companies c ON p.company_id = c.id
      WHERE (p.shares + p.locked_shares) > 0
    `);

    const userPortfoliosMap: { [userId: string]: { holdings: any[]; portfolioValue: number; tradingValue: number; founderValue: number } } = {};
    for (const row of portfoliosRes.rows as any[]) {
      const uId = String(row.user_id);
      if (!userPortfoliosMap[uId]) {
        userPortfoliosMap[uId] = { holdings: [], portfolioValue: 0, tradingValue: 0, founderValue: 0 };
      }
      const totalShares = Number(row.shares || 0) + Number(row.locked_shares || 0);
      const curPrice = Number(row.current_price || 0);
      const val = totalShares * curPrice;
      const isCreator = String(row.creator_id) === uId;

      userPortfoliosMap[uId].portfolioValue += val;
      if (isCreator) {
        userPortfoliosMap[uId].founderValue += val;
      } else {
        userPortfoliosMap[uId].tradingValue += val;
      }

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
        isCreator,
      });
    }

    const enrichedCitizens = (citizensRes.rows as any[]).map((c) => {
      const uId = String(c.id);
      const port = userPortfoliosMap[uId] || { holdings: [], portfolioValue: 0, tradingValue: 0, founderValue: 0 };
      const cash = Number(c.cash_balance || 0);
      const lockedCash = Number(c.locked_cash || 0);
      const portfolioValue = port.portfolioValue;
      const tradingValue = port.tradingValue;
      const founderValue = port.founderValue;
      // Total Platform Capital strictly excludes the founder's own company shares
      const totalNetWorth = Math.round((cash + lockedCash + tradingValue) * 100) / 100;
      const founderCompanies = companies.filter((comp) => String(comp.creatorId) === uId);
      const corporateTreasuryBalance = founderCompanies.reduce((acc, comp) => acc + (comp.treasuryBalance || 0), 0);
      const totalProfitDeposited = founderCompanies.reduce((acc, comp) => acc + (comp.totalProfitDeposited || 0), 0);

      return {
        ...c,
        cash_balance: cash,
        locked_cash: lockedCash,
        portfolio_value: portfolioValue,
        trading_value: tradingValue,
        founder_value: founderValue,
        total_net_worth: totalNetWorth,
        corporate_treasury_balance: corporateTreasuryBalance,
        total_profit_deposited: totalProfitDeposited,
        founder_companies: founderCompanies.map((fc) => ({
          id: fc.id,
          ticker: fc.ticker,
          name: fc.name,
          treasuryBalance: fc.treasuryBalance || 0,
          totalProfitDeposited: fc.totalProfitDeposited || 0,
        })),
        holdings: port.holdings,
      };
    });

    // Rank citizens by true platform capital (highest liquid + secondary holdings first)
    enrichedCitizens.sort((a, b) => (Number(b.total_net_worth) || 0) - (Number(a.total_net_worth) || 0));

    const { getEarningsReports, getNextFridayUtc, processScheduledDividends } = await import("@/lib/dividends");
    await processScheduledDividends().catch(() => {});
    const earningsReports = await getEarningsReports();
    const nextFriday = getNextFridayUtc();

    const { getLedgerEntries, getTradeInsights } = await import("@/lib/ledger");
    const ledgerEntries = await getLedgerEntries(60);
    const tradeInsights = await getTradeInsights();

    // Financial & Treasury Metrics for the Operator
    const [treasuryRes, operatorRes, tradeStatsRes, walletStatsRes] = await Promise.all([
      db.execute("SELECT cash_balance, locked_cash FROM users WHERE id = 'usr_treasury'"),
      db.execute({ sql: "SELECT cash_balance, locked_cash FROM users WHERE id = ?", args: [user.id] }),
      db.execute("SELECT COUNT(*) as trade_count, COALESCE(SUM(total), 0) as total_volume FROM trades"),
      db.execute(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'DEPOSIT' AND status IN ('CREDITED', 'COMPLETED') THEN amount ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN type = 'DEPOSIT' AND status IN ('CREDITED', 'COMPLETED') THEN iron_units ELSE 0 END), 0) as total_iron_deposited,
          COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' AND status = 'COMPLETED' THEN amount ELSE 0 END), 0) as total_withdrawals,
          COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' AND status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_withdrawals
        FROM wallet_transactions
      `),
    ]);

    const treasuryRow: any = treasuryRes.rows[0] || { cash_balance: 0, locked_cash: 0 };
    const operatorRow: any = operatorRes.rows[0] || { cash_balance: user.cashBalance || 0, locked_cash: user.lockedCash || 0 };
    const tradeStatsRow: any = tradeStatsRes.rows[0] || { trade_count: 0, total_volume: 0 };
    const walletStatsRow: any = walletStatsRes.rows[0] || { total_deposits: 0, total_iron_deposited: 0, total_withdrawals: 0, pending_withdrawals: 0 };

    const operatorCash = Number(operatorRow.cash_balance || 0);
    const operatorLocked = Number(operatorRow.locked_cash || 0);
    const treasuryCash = Number(treasuryRow.cash_balance || 0);

    let totalCitizenCash = 0;
    let totalCitizenLocked = 0;
    for (const c of enrichedCitizens) {
      totalCitizenCash += Number(c.cash_balance || 0);
      totalCitizenLocked += Number(c.locked_cash || 0);
    }

    const tradeVolume = Number(tradeStatsRow.total_volume || 0);
    const tradeFeeRate = (Number(tradeFee) || 0.5) / 100;
    const totalTradeFees = Math.round(tradeVolume * tradeFeeRate * 100) / 100;
    const totalListingFees = companies.length * (Number(listingFee) || 200);
    const totalPlatformProfit = Math.round((treasuryCash + totalTradeFees + totalListingFees) * 100) / 100;

    const financialSummary = {
      operatorName: user.displayName || user.username,
      operatorCash,
      operatorLocked,
      operatorTotal: Math.round((operatorCash + operatorLocked) * 100) / 100,
      treasuryBalance: treasuryCash,
      totalCitizenGold: Math.round((totalCitizenCash + totalCitizenLocked) * 100) / 100,
      totalCitizenCash: Math.round(totalCitizenCash * 100) / 100,
      totalCitizenLocked: Math.round(totalCitizenLocked * 100) / 100,
      citizenCount: enrichedCitizens.length,
      totalTradeVolume: tradeVolume,
      tradeCount: Number(tradeStatsRow.trade_count || 0),
      totalTradeFees,
      totalListingFees,
      totalIpoFees: totalListingFees,
      totalPlatformProfit,
      totalDepositedGold: Number(walletStatsRow.total_deposits || 0),
      totalIronUnitsDeposited: Number(walletStatsRow.total_iron_deposited || 0),
      totalWithdrawnGold: Number(walletStatsRow.total_withdrawals || 0),
      pendingWithdrawalsGold: Number(walletStatsRow.pending_withdrawals || 0),
      netGoldInCustody: Math.round((Number(walletStatsRow.total_deposits || 0) - Number(walletStatsRow.total_withdrawals || 0)) * 100) / 100,
    };

    return NextResponse.json({
      success: true,
      settings: {
        taxRate: Number(taxRate),
        houseName,
        apiKey,
        autoApprove: autoApprove === "true",
        tradeFee: Number(tradeFee),
        listingFee: Number(listingFee),
        discordWebhookUrl: discordWebhookUrl || "",
        discordWhaleThreshold: Number(discordWhaleThreshold) || 25,
        discordAlertsEnabled: discordAlertsEnabled !== "false",
        parlamentumCookie: parlamentumCookie ? (parlamentumCookie.slice(0, 15) + "..." + parlamentumCookie.slice(-10)) : "",
        hasParlamentumCookie: Boolean(parlamentumCookie && parlamentumCookie.trim()),
        lastCloudSyncAt: lastCloudSyncAt || null,
        lastCloudSyncStatus: lastCloudSyncStatus || "IDLE",
        lastCloudSyncMessage: lastCloudSyncMessage || "",
        lastCloudSyncFills: Number(lastCloudSyncFills) || 0,
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
      financialSummary,
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
      if (entry.status === "QUEUED_FOR_APPROVAL") {
        return NextResponse.json({ success: false, message: "This fill is waiting in the deposit queue. Approve it there." }, { status: 409 });
      }
      const claim = await db.execute({
        sql: `UPDATE parlamentum_ledger_entries SET status = 'AUTO_CREDITED', with_user = ?
              WHERE id = ? AND status NOT IN ('AUTO_CREDITED', 'MATCHED_PENDING', 'QUEUED_FOR_APPROVAL')`,
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
      const amount = Number(goldAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ success: false, message: "Enter a credit above 0. To lower a purse, use the balance editor." }, { status: 400 });
      }
      const res = await manualCreditCitizen(parlamentumName, amount, reason);
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

      // Set the balance only if it is still what the operator saw: a trade or deposit in between would be overwritten
      const set = await db.execute({
        sql: "UPDATE users SET cash_balance = ? WHERE id = ? AND cash_balance = ?",
        args: [targetBalance, userId, oldBalance],
      });
      if (set.rowsAffected === 0) {
        return NextResponse.json({ success: false, message: "The balance changed meanwhile. Reload and try again." }, { status: 409 });
      }

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
      const { taxRate, houseName, autoApprove, apiKey, tradeFee, listingFee, discordWebhookUrl, discordWhaleThreshold, discordAlertsEnabled, parlamentumCookie } = body;
      if (parlamentumCookie !== undefined) await setSetting("parlamentum_cookie", String(parlamentumCookie).trim());
      if (taxRate !== undefined) await setSetting("tax_rate", String(taxRate));
      if (houseName !== undefined) await setSetting("house_name", String(houseName));
      if (autoApprove !== undefined) await setSetting("auto_approve_deposits", String(autoApprove));
      if (apiKey !== undefined) await setSetting("api_key", String(apiKey));
      if (tradeFee !== undefined) await setSetting("trade_fee_percent", String(tradeFee));
      if (listingFee !== undefined) await setSetting("ipo_listing_fee", String(listingFee));
      if (discordWebhookUrl !== undefined) await setSetting("discord_webhook_url", String(discordWebhookUrl));
      if (discordWhaleThreshold !== undefined) await setSetting("discord_whale_threshold", String(discordWhaleThreshold));
      if (discordAlertsEnabled !== undefined) await setSetting("discord_alerts_enabled", String(discordAlertsEnabled));

      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();

      return NextResponse.json({ success: true, message: "Operator settings updated successfully!" });
    }

    if (action === "trigger_cloud_sync") {
      const { triggerCloudLedgerSync } = await import("@/lib/cloudSync");
      const res = await triggerCloudLedgerSync(true);
      const { scheduleBlobPersist } = await import("@/lib/db");
      scheduleBlobPersist();
      return NextResponse.json(res);
    }

    if (action === "test_discord_webhook") {
      const { webhookUrl } = body;
      const { sendDiscordEmbed } = await import("@/lib/discord");
      const testRes = await sendDiscordEmbed(
        {
          title: "✅ Grow UR Gold Discord Bot Connected!",
          description: "Your Discord webhook is properly configured and active. Whale trade alerts and deposit announcements will now arrive in this channel in real time.",
          color: 0x10b981,
          fields: [
            { name: "Status", value: "🟢 Active & Verified", inline: true },
            { name: "Operator", value: `@${user.displayName || user.username}`, inline: true },
            { name: "Platform", value: "[Grow UR Gold Exchange](https://growurgold.vercel.app)", inline: true },
          ],
        },
        webhookUrl
      );

      if (!testRes.success) {
        return NextResponse.json(
          { success: false, message: testRes.message || "Failed to deliver test alert to Discord. Check your Webhook URL." },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: "Test alert delivered to Discord successfully!" });
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

    if (action === "deposit_company_profit") {
      const { companyId, amount, notes, source } = body;
      const { depositCompanyProfit } = await import("@/lib/dividends");
      const res = await depositCompanyProfit({
        companyId,
        amount: Number(amount),
        reporterId: user.id,
        notes,
        source: source === "DIRECT" ? "MANUAL_DIRECT" : "WALLET",
      });
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
