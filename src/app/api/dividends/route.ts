import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { 
  getEarningsReports, 
  reportEarningsAndDividend, 
  executeDividendPayout, 
  processScheduledDividends, 
  getNextFridayUtc 
} from "@/lib/dividends";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId") || undefined;

    // Automatically check and process any Friday UTC 00:00 reports that became due
    await processScheduledDividends().catch(err => console.warn("Scheduled dividend sweep notice:", err));

    const reports = await getEarningsReports(companyId);
    const nextFriday = getNextFridayUtc();

    return NextResponse.json({
      success: true,
      reports,
      nextFriday: nextFriday.toISOString(),
    });
  } catch (error: any) {
    console.error("GET /api/dividends error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }

    if (user.isFrozen) {
      return NextResponse.json({ success: false, message: "Account is frozen by the operator." }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === "report_earnings") {
      const { 
        companyId, 
        grossRevenue, 
        operatingExpenses, 
        netProfit, 
        periodTitle, 
        notes, 
        distributeImmediately,
        scheduledFor,
        dividendPercent 
      } = body;

      if (!companyId) {
        return NextResponse.json({ success: false, message: "Company ID is required." }, { status: 400 });
      }

      const profitVal = parseFloat(netProfit);
      if (isNaN(profitVal) || profitVal <= 0) {
        return NextResponse.json({ success: false, message: "Please provide a valid net profit in gold (greater than 0)." }, { status: 400 });
      }

      const res = await reportEarningsAndDividend({
        companyId,
        reporterId: user.id,
        grossRevenue: grossRevenue ? parseFloat(grossRevenue) : undefined,
        operatingExpenses: operatingExpenses ? parseFloat(operatingExpenses) : undefined,
        netProfit: profitVal,
        periodTitle,
        dividendPercent: dividendPercent !== undefined ? parseFloat(dividendPercent) : undefined,
        notes,
        distributeImmediately: Boolean(distributeImmediately),
        scheduledFor,
      });

      return NextResponse.json(res);
    }

    if (action === "distribute_now") {
      if (!user.isAdmin) {
        return NextResponse.json({ success: false, message: "Only the exchange operator can manually force immediate distribution." }, { status: 403 });
      }

      const { reportId } = body;
      const res = await executeDividendPayout(reportId);
      return NextResponse.json(res);
    }

    if (action === "process_scheduled") {
      const res = await processScheduledDividends();
      return NextResponse.json({ success: true, message: `Processed ${res.executedCount} scheduled Friday dividend distributions.`, ...res });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/dividends error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process earnings/dividends." }, { status: 500 });
  }
}
