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

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/trade error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
