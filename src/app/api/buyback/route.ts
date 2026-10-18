import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { executeShareBuyback } from "@/lib/market";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }

    if (user.isFrozen) {
      return NextResponse.json({ 
        success: false, 
        message: "Your citizen wallet has been frozen by the operator." 
      }, { status: 403 });
    }

    const body = await request.json();
    const { ticker, goldToSpend } = body;

    if (!ticker) {
      return NextResponse.json({ success: false, message: "Ticker symbol is required." }, { status: 400 });
    }

    const goldAmount = parseFloat(goldToSpend);
    if (isNaN(goldAmount) || goldAmount < 10) {
      return NextResponse.json({ success: false, message: "Minimum buyback allocation is 10 gold." }, { status: 400 });
    }

    const result = await executeShareBuyback({
      founderId: user.id,
      ticker,
      goldToSpend: goldAmount,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      sharesAcquired: result.sharesAcquired,
      avgPrice: result.avgPrice,
      totalSpent: result.totalSpent,
    });
  } catch (error: any) {
    console.error("POST /api/buyback error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process buyback." }, { status: 500 });
  }
}
