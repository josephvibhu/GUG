import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createStockGift, redeemStockGift, cancelStockGift, getUserStockGifts } from "@/lib/gifts";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, sent: [], received: [] });
    }

    const data = await getUserStockGifts(user.id);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("GET /api/gifts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in to manage stock gifts." }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const userName = user.parlamentumName || user.displayName || user.username;

    if (action === "create") {
      const { companyId, shares, note } = body;
      if (!companyId || !shares) {
        return NextResponse.json({ success: false, message: "Company and share count are required." }, { status: 400 });
      }
      const res = await createStockGift(user.id, userName, companyId, Number(shares), note);
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === "redeem") {
      const { code } = body;
      if (!code) {
        return NextResponse.json({ success: false, message: "Please provide a gift coupon code." }, { status: 400 });
      }
      const res = await redeemStockGift(user.id, userName, String(code));
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    if (action === "cancel") {
      const { giftId } = body;
      if (!giftId) {
        return NextResponse.json({ success: false, message: "Gift ID is required." }, { status: 400 });
      }
      const res = await cancelStockGift(user.id, String(giftId));
      return NextResponse.json(res, { status: res.success ? 200 : 400 });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/gifts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
