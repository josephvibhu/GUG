import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNftAuction, getLiveAuctions, getPastAuctions, getNftSettings } from "@/lib/nft";

// GET /api/nft/auction — all live/scheduled auctions + settings
export async function GET() {
  try {
    const [auctions, past, settings] = await Promise.all([
      getLiveAuctions(),
      getPastAuctions(10),
      getNftSettings(),
    ]);
    return NextResponse.json({ success: true, auctions, past, settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST /api/nft/auction — create auction (admin only)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin only." }, { status: 403 });
    }

    const body = await request.json();
    const { nftId, reservePrice, startPrice, durationHours, startsAt, houseCutBps } = body;

    if (!nftId) return NextResponse.json({ success: false, message: "nftId is required." }, { status: 400 });
    if (!startPrice || Number(startPrice) <= 0) {
      return NextResponse.json({ success: false, message: "startPrice must be > 0." }, { status: 400 });
    }

    const result = await createNftAuction({
      sellerId: user.id,
      nftId: String(nftId),
      reservePrice: Number(reservePrice) || 0,
      startPrice: Number(startPrice),
      durationHours: durationHours ? Number(durationHours) : undefined,
      startsAt: startsAt ? String(startsAt) : undefined,
      houseCutBps: houseCutBps !== undefined ? Number(houseCutBps) : undefined,
    });

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (err: any) {
    console.error("POST /api/nft/auction error:", err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
