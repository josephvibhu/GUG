import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
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
      getSetting("api_key", "pse_secret_parlamentum_key_2026"),
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

    // Fetch citizens list with freeze status
    const citizensRes = await db.execute(`
      SELECT id, username, display_name, parlamentum_name, cash_balance, locked_cash, is_admin, is_frozen, created_at 
      FROM users 
      ORDER BY cash_balance DESC
    `);

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
      citizens: citizensRes.rows,
    });
  } catch (error: any) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
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

    // Automated Parlamentum in-game sale event webhook
    if (action === "webhook_credit" || action === "webhook_sale_event") {
      const { apiKey, buyerName, goldAmount, ironUnits, rawNotification } = body;
      const expectedKey = await getSetting("api_key", "pse_secret_parlamentum_key_2026");

      if (apiKey !== expectedKey) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401, headers: corsHeaders });
      }

      const db = getDb();
      const units = Number(ironUnits) || (goldAmount ? Math.ceil(Number(goldAmount) / 5) : 0);
      const gold = Number(goldAmount) || (units * 5);

      // 1. If buyerName is specified, find their pending deposit or credit directly
      if (buyerName) {
        const pending = await db.execute({
          sql: `SELECT wt.id FROM wallet_transactions wt
                JOIN users u ON wt.user_id = u.id
                WHERE (LOWER(u.username) = ? OR LOWER(wt.parlamentum_name) = ?)
                AND wt.type = 'DEPOSIT' AND wt.status = 'PENDING'
                ORDER BY wt.created_at DESC LIMIT 1`,
          args: [buyerName.toLowerCase(), buyerName.toLowerCase()],
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

    // Direct Purge & Admin Setup (secured by API key)
    if (action === "purge_users_and_create_admin") {
      const { apiKey } = body;
      const expectedKey = await getSetting("api_key", "pse_secret_parlamentum_key_2026");

      if (apiKey !== expectedKey) {
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
        sql: `UPDATE users SET cash_balance = 5.0, locked_cash = 0.0 WHERE id = ?`,
        args: [sanjayId]
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

    if (action === "approve") {
      const { txId } = body;
      const res = await approveDeposit(txId);
      return NextResponse.json(res);
    }

    if (action === "reject") {
      const { txId } = body;
      const { rejectTransaction } = await import("@/lib/wallet");
      const res = await rejectTransaction(txId);
      return NextResponse.json(res);
    }

    if (action === "manual_credit") {
      const { parlamentumName, goldAmount, reason } = body;
      const res = await manualCreditCitizen(parlamentumName, Number(goldAmount), reason);
      return NextResponse.json(res);
    }

    if (action === "update_settings") {
      const { taxRate, houseName, autoApprove, apiKey, tradeFee, listingFee } = body;
      if (taxRate !== undefined) await setSetting("tax_rate", String(taxRate));
      if (houseName !== undefined) await setSetting("house_name", String(houseName));
      if (autoApprove !== undefined) await setSetting("auto_approve_deposits", String(autoApprove));
      if (apiKey !== undefined) await setSetting("api_key", String(apiKey));
      if (tradeFee !== undefined) await setSetting("trade_fee_percent", String(tradeFee));
      if (listingFee !== undefined) await setSetting("ipo_listing_fee", String(listingFee));

      return NextResponse.json({ success: true, message: "Operator settings updated successfully!" });
    }

    if (action === "freeze_user") {
      const { userId } = body;
      const db = getDb();
      await db.execute({
        sql: "UPDATE users SET is_frozen = 1 WHERE id = ?",
        args: [userId],
      });
      return NextResponse.json({ success: true, message: "Citizen wallet FROZEN. All trading & withdrawal halted." });
    }

    if (action === "unfreeze_user") {
      const { userId } = body;
      const db = getDb();
      await db.execute({
        sql: "UPDATE users SET is_frozen = 0 WHERE id = ?",
        args: [userId],
      });
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
      return NextResponse.json({ success: true, message: `Company status updated to ${status}.` });
    }

    if (action === "approve_ipo") {
      const { appId, negotiatedPrice, negotiatedShares, operatorNotes } = body;
      const { approveAndListIPO } = await import("@/lib/market");
      const res = await approveAndListIPO(
        appId, 
        negotiatedPrice !== undefined ? Number(negotiatedPrice) : undefined, 
        negotiatedShares !== undefined ? Number(negotiatedShares) : undefined, 
        operatorNotes
      );
      return NextResponse.json(res);
    }

    if (action === "reject_ipo") {
      const { appId, reason } = body;
      const { rejectIPOApplication } = await import("@/lib/market");
      const res = await rejectIPOApplication(appId, reason);
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

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
