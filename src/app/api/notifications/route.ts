import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    const user = await getCurrentUser();

    // 1. Fetch DC liquidation decree
    const decreeRes = await db.execute("SELECT value FROM settings WHERE key = 'dc_liquidation_decree'");
    const decree = decreeRes.rows[0]?.value ? JSON.parse(String(decreeRes.rows[0].value)) : null;

    // 2. Fetch DC founder appeal
    const appealRes = await db.execute("SELECT value FROM settings WHERE key = 'dc_founder_appeal'");
    const appeal = appealRes.rows[0]?.value ? JSON.parse(String(appealRes.rows[0].value)) : null;

    // 3. Check DC company founder
    const dcComp = await db.execute("SELECT id, creator_id FROM companies WHERE ticker = 'DC'");
    const isDcFounder = user && dcComp.rows.length > 0 && String(user.id) === String(dcComp.rows[0].creator_id);

    let dcShareholderPayout: { shares: number; amount: number; txId: string } | null = null;
    if (user) {
      const txRes = await db.execute({
        sql: `
          SELECT * FROM wallet_transactions 
          WHERE user_id = ? AND method = 'LIQUIDATION_RESTITUTION' AND recipe_note LIKE '%DC%'
          ORDER BY created_at DESC LIMIT 1
        `,
        args: [user.id],
      });
      if (txRes.rows.length > 0) {
        const tx = txRes.rows[0];
        const match = String(tx.recipe_note).match(/(\d+)\s+shares/);
        dcShareholderPayout = {
          shares: match ? parseInt(match[1], 10) : 0,
          amount: Number(tx.amount || 0),
          txId: String(tx.id),
        };
      }
    }

    const notifications: any[] = [];

    // Add DC Decree notification
    if (decree) {
      notifications.push({
        id: "notif_dc_liquidation",
        type: "REGULATORY_DECREE",
        title: "Regulatory Decree: Dissolution of Dynamax Corporation ($DC)",
        date: decree.dissolvedAt || "2026-11-05",
        summary: "Dynamax Corporation has been liquidated due to non-filing of weekly financial reports and dividends. Unclaimed IPO funds and an 80% GUG fine grant have been refunded to public shareholders.",
        data: {
          decree,
          appeal,
          isFounder: isDcFounder,
          shareholderPayout: dcShareholderPayout,
        },
      });
    }

    // Add recent user transactions if logged in
    if (user) {
      const recentTxs = await db.execute({
        sql: "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5",
        args: [user.id],
      });

      for (const tx of recentTxs.rows) {
        if (tx.method === 'LIQUIDATION_RESTITUTION') continue; // Handled in decree
        notifications.push({
          id: `notif_tx_${tx.id}`,
          type: "WALLET_ACTIVITY",
          title: `${tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} ${tx.status}`,
          date: tx.created_at,
          summary: `${tx.amount} gold — ${tx.recipe_note || tx.method}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (err: any) {
    console.error("GET /api/notifications error:", err);
    return NextResponse.json({ success: false, message: err?.message || "Internal error" }, { status: 500 });
  }
}
