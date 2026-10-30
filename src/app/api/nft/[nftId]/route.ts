import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getNftById } from "@/lib/nft";

// GET /api/nft/[nftId] — single NFT with provenance
export async function GET(_request: Request, { params }: { params: Promise<{ nftId: string }> }) {
  try {
    const { nftId } = await params;
    const nft = await getNftById(nftId);
    if (!nft) return NextResponse.json({ success: false, message: "NFT not found." }, { status: 404 });
    return NextResponse.json({ success: true, nft });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
