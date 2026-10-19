import { NextResponse } from "next/server";
import { getCompanyByTicker, getTradeCandles, CANDLE_INTERVALS } from "@/lib/market";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const interval = new URL(request.url).searchParams.get("interval") || "1h";
    if (!CANDLE_INTERVALS[interval]) {
      return NextResponse.json({ success: false, error: `Unknown interval. Use one of: ${Object.keys(CANDLE_INTERVALS).join(", ")}` }, { status: 400 });
    }

    const company = await getCompanyByTicker(ticker);
    if (!company) {
      return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
    }

    const candles = await getTradeCandles(company.id, interval);
    return NextResponse.json({ success: true, interval, candles, ipoPrice: company.ipoPrice });
  } catch (error) {
    console.error("API /api/market/[ticker]/candles error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
