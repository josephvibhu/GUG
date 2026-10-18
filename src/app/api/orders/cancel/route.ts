import { NextResponse } from "next/server";
import { cancelOrder } from "@/lib/engine";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ success: false, message: "Missing order ID" }, { status: 400 });
    }

    const result = await cancelOrder(user.id, orderId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/orders/cancel error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
