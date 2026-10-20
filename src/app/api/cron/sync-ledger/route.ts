import { NextResponse } from "next/server";
import { triggerCloudLedgerSync } from "@/lib/cloudSync";
import { watcherOn, watch, watchView } from "@/lib/watcher";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 30; // 30s timeout on Vercel

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  try {
    // Vercel cron (and any outside scheduler) sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set
    // in the project's environment variables. The API key and query-string keys are not accepted here.
    const cronSecret = process.env.CRON_SECRET || "";
    const authHeader = request.headers.get("authorization") || "";
    let isAuthorized = cronSecret.length >= 16 && authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized) {
      const user = await getCurrentUser();
      isAuthorized = !!user?.isAdmin;
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    // With the watcher on, the daily cron is its fallback look (the game shows only the last 200 trades)
    if (await watcherOn()) {
      await watch(true);
      const view = await watchView();
      return NextResponse.json({ success: !view.error, timestamp: new Date().toISOString(), message: view.error || "Watcher looked at the game." });
    }

    const result = await triggerCloudLedgerSync();

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      message: result.message,
      fillsFound: result.fillsFound,
      credited: result.newCredits.length,
      expired: result.expired,
    });
  } catch (error) {
    console.error("GET/POST /api/cron/sync-ledger error:", error);
    return NextResponse.json({ success: false, message: "Sync failed. See the server log." }, { status: 500 });
  }
}
