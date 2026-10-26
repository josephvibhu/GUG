import { NextResponse } from "next/server";
import { placeOrder } from "@/lib/engine";
import { getCurrentUser } from "@/lib/auth";
import { isTradingAllowed } from "@/lib/marketHours";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized. Please log in." }, { status: 401 });
    }

    if (user.isManager) {
      return NextResponse.json({ success: false, message: "Manager accounts cannot place trades on the exchange floor." }, { status: 403 });
    }

    const tradingCheck = await isTradingAllowed();
    if (!tradingCheck.allowed) {
      return NextResponse.json({ success: false, message: tradingCheck.reason }, { status: 403 });
    }

    const body = await request.json();
    const { companyId, type, orderType, price, quantity } = body;

    if (!companyId || !type || !orderType || !quantity) {
      return NextResponse.json({ success: false, message: "Missing required order fields" }, { status: 400 });
    }

    const result = await placeOrder({
      userId: user.id,
      companyId,
      type: type.toUpperCase() as "BUY" | "SELL",
      orderType: orderType.toUpperCase() as "LIMIT" | "MARKET",
      price: Number(price) || 0,
      quantity: Number(quantity),
    });

    if (result.success && result.tradesExecuted && result.tradesExecuted.length > 0) {
      import("@/lib/discord").then(async ({ notifyDiscordTrade }) => {
        const { getDb } = await import("@/lib/db");
        const db = getDb();
        const compRes = await db.execute({
          sql: "SELECT ticker, name FROM companies WHERE id = ? OR ticker = ? LIMIT 1",
          args: [companyId, companyId],
        });
        const comp = compRes.rows[0];
        const ticker = comp ? String(comp.ticker) : companyId;
        const companyName = comp ? String(comp.name) : companyId;

        for (const t of result.tradesExecuted) {
          const trdRes = await db.execute({
            sql: `SELECT t.*, b.username as buyer_name, s.username as seller_name 
                  FROM trades t
                  JOIN users b ON t.buyer_id = b.id
                  JOIN users s ON t.seller_id = s.id
                  WHERE t.id = ? LIMIT 1`,
            args: [t.tradeId],
          });
          const row = trdRes.rows[0];
          const buyer = row ? String(row.buyer_name) : user.username;
          const seller = row ? String(row.seller_name) : "Market";

          notifyDiscordTrade({
            ticker,
            companyName,
            buyerName: buyer,
            sellerName: seller,
            price: Number(t.price),
            quantity: Number(t.quantity),
            total: Number(t.total),
          });
        }
      }).catch((err) => console.warn("Discord trade alert failed:", err));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/trade error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
