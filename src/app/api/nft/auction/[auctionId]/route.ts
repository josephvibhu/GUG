import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuctionById, settleAuction, cancelAuction } from "@/lib/nft";

// GET /api/nft/auction/[auctionId] — single auction with bids
export async function GET(_req: Request, { params }: { params: Promise<{ auctionId: string }> }) {
  try {
    const { auctionId } = await params;
    const auction = await getAuctionById(auctionId);
    if (!auction) return NextResponse.json({ success: false, message: "Auction not found." }, { status: 404 });
    return NextResponse.json({ success: true, auction });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST /api/nft/auction/[auctionId] — admin actions: settle | cancel
export async function POST(request: Request, { params }: { params: Promise<{ auctionId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin only." }, { status: 403 });
    }

    const { auctionId } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === "settle") {
      const result = await settleAuction(auctionId, user.id);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (action === "cancel") {
      const result = await cancelAuction(auctionId, user.id);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: "Unknown action. Use 'settle' or 'cancel'." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
