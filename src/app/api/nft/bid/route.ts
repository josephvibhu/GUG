import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { placeBid } from "@/lib/nft";

// POST /api/nft/bid — place a bid on a live auction
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in to bid." }, { status: 401 });
    }
    if (user.isManager) {
      return NextResponse.json({ success: false, message: "Manager accounts cannot bid." }, { status: 403 });
    }

    const body = await request.json();
    const { auctionId, amount } = body;

    if (!auctionId) return NextResponse.json({ success: false, message: "auctionId is required." }, { status: 400 });
    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, message: "amount must be > 0." }, { status: 400 });
    }

    const result = await placeBid({
      bidderId: user.id,
      auctionId: String(auctionId),
      amount: Number(amount),
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err: any) {
    console.error("POST /api/nft/bid error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
