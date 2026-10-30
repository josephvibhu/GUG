import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, initDb, scheduleBlobPersist } from "@/lib/db";

const ALLOWED_KEYS = [
  "nft_house_cut_bps",
  "nft_creator_royalty_bps",
  "nft_min_bid_increment_pct",
  "nft_snipe_extension_min",
  "nft_default_duration_hours",
];

// POST /api/nft/settings — update NFT operator settings (admin only)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ success: false, message: "Admin only." }, { status: 403 });
    }

    await initDb();
    const db = getDb();
    const body = await request.json();

    for (const key of ALLOWED_KEYS) {
      if (body[key] !== undefined) {
        const v = String(body[key]);
        if (!/^\d+$/.test(v)) {
          return NextResponse.json({ success: false, message: `${key} must be a non-negative integer.` }, { status: 400 });
        }
        await db.execute({
          sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          args: [key, v],
        });
      }
    }

    scheduleBlobPersist();
    return NextResponse.json({ success: true, message: "NFT settings updated." });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
