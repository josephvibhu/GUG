import { NextResponse } from "next/server";
import { tickAuctions } from "@/lib/nft";
import { getCurrentUser } from "@/lib/auth";

export const maxDuration = 30;

// GET /api/cron/tick-auctions — promotes SCHEDULED→LIVE and LIVE→ENDED
// Secured the same way as sync-ledger: CRON_SECRET header or admin session
export async function GET(request: Request) {
  return handleTick(request);
}

export async function POST(request: Request) {
  return handleTick(request);
}

async function handleTick(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET || "";
    const authHeader = request.headers.get("authorization") || "";
    let authorized = cronSecret.length >= 16 && authHeader === `Bearer ${cronSecret}`;

    if (!authorized) {
      const user = await getCurrentUser();
      authorized = !!user?.isAdmin;
    }

    if (!authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    await tickAuctions();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), message: "Auction states ticked." });
  } catch (err: any) {
    console.error("tick-auctions cron error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
