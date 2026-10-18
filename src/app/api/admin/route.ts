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

    const [taxRate, houseName, apiKey, autoApprove, tradeFee] = await Promise.all([
      getSetting("tax_rate", "10"),
      getSetting("house_name", "Parliament_Exchange"),
      getSetting("api_key", "pse_secret_parlamentum_key_2026"),
      getSetting("auto_approve_deposits", "true"),
      getSetting("trade_fee_percent", "0.5"),
    ]);

    const { getMarketSchedule } = await import("@/lib/marketHours");
    const { getIPOApplications } = await import("@/lib/market");
    const [marketSchedule, ipoApplications] = await Promise.all([
      getMarketSchedule(),
      getIPOApplications("PENDING"),
    ]);

    // Fetch pending transactions
    const pendingRes = await db.execute(`
      SELECT w.*, u.username 
      FROM wallet_transactions w
      JOIN users u ON w.user_id = u.id
      WHERE w.status = 'PENDING'
      ORDER BY w.created_at DESC
    `);

    // Fetch citizens list
    const citizensRes = await db.execute(`
      SELECT id, username, display_name, parlamentum_name, cash_balance, locked_cash, is_admin, created_at 
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
      },
      marketSchedule,
      pendingDeposits: pendingRes.rows,
      ipoApplications,
      citizens: citizensRes.rows,
    });
  } catch (error: any) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { action } = body;

    // Webhook bypass: if using secret API key
    if (action === "webhook_credit") {
      const { apiKey, buyerName, goldAmount, ironUnits } = body;
      const expectedKey = await getSetting("api_key", "pse_secret_parlamentum_key_2026");

      if (apiKey !== expectedKey) {
        return NextResponse.json({ success: false, message: "Invalid API Key." }, { status: 401 });
      }

      const calculatedGold = goldAmount || (Number(ironUnits) * 5);
      const res = await manualCreditCitizen(
        buyerName, 
        calculatedGold, 
        `Automated Parlamentum sale webhook (${ironUnits || Math.ceil(calculatedGold/5)} Raw Iron)`
      );
      return NextResponse.json(res);
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
      const db = getDb();
      await db.execute({
        sql: "UPDATE wallet_transactions SET status = 'REJECTED' WHERE id = ?",
        args: [txId],
      });
      return NextResponse.json({ success: true, message: "Deposit rejected." });
    }

    if (action === "manual_credit") {
      const { parlamentumName, goldAmount, reason } = body;
      const res = await manualCreditCitizen(parlamentumName, Number(goldAmount), reason);
      return NextResponse.json(res);
    }

    if (action === "update_settings") {
      const { taxRate, houseName, autoApprove, apiKey, tradeFee } = body;
      if (taxRate !== undefined) await setSetting("tax_rate", String(taxRate));
      if (houseName !== undefined) await setSetting("house_name", String(houseName));
      if (autoApprove !== undefined) await setSetting("auto_approve_deposits", String(autoApprove));
      if (apiKey !== undefined) await setSetting("api_key", String(apiKey));
      if (tradeFee !== undefined) await setSetting("trade_fee_percent", String(tradeFee));

      return NextResponse.json({ success: true, message: "Operator settings updated successfully!" });
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
