import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserReferralDashboard } from "@/lib/referrals";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }

    const data = await getUserReferralDashboard(user.id, user.username);
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error("GET /api/referrals error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
