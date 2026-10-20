import { NextResponse } from "next/server";
import { triggerCloudLedgerSync } from "@/lib/cloudSync";
import { getSetting } from "@/lib/wallet";
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
    const url = new URL(request.url);
    const keyParam = url.searchParams.get("key") || url.searchParams.get("apiKey") || "";
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";

    const [configuredApiKey, cronSecret] = await Promise.all([
      getSetting("api_key", ""),
      getSetting("cron_secret", process.env.CRON_SECRET || ""),
    ]);

    let isAuthorized = isVercelCron;

    if (!isAuthorized && keyParam && (keyParam === configuredApiKey || (cronSecret && keyParam === cronSecret))) {
      isAuthorized = true;
    }

    if (!isAuthorized && bearerToken && (bearerToken === configuredApiKey || (cronSecret && bearerToken === cronSecret))) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      // Check if logged in as admin
      const user = await getCurrentUser();
      if (user && user.isAdmin) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Provide a valid ?key=<apiKey> parameter or log in as exchange operator.",
        },
        { status: 401 }
      );
    }

    // Trigger cloud synchronization
    const result = await triggerCloudLedgerSync();

    return NextResponse.json({
      success: result.success,
      timestamp: new Date().toISOString(),
      message: result.message,
      fillsFound: result.fillsFound,
      newCredits: result.newCredits,
      expired: result.expired,
    });
  } catch (error: any) {
    console.error("GET/POST /api/cron/sync-ledger error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
